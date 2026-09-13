import { DurableObject } from 'cloudflare:workers'
import * as Y from 'yjs'
import * as syncProtocol from 'y-protocols/sync'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as decoding from 'lib0/decoding'
import * as encoding from 'lib0/encoding'
import { updateProjectNoteContent, getProjectNoteById } from '../repositories/vms-project-notes.repository'
import type { AppBindings } from '../types/bindings'
import { extractMarkdownNoteContent, extractNoteContent } from '../utils/yjs-rich-text'
import { hashNoteContent, reindexNoteVectors } from '../services/note-embeddings.service'

const MESSAGE_SYNC = 0
const MESSAGE_AWARENESS = 1
const MESSAGE_CONTROL = 2
const SQL_PERSIST_DEBOUNCE_MS = 1500

type NoteContentType = 'html' | 'markdown'

interface SocketAttachment {
  membershipNumber: string
  displayName: string
  focusedNoteId: string | null
  awarenessIds: number[]
}

interface NoteSession {
  noteId: string
  contentType: NoteContentType
  doc: Y.Doc
  awareness: awarenessProtocol.Awareness
  yjsPersistChain: Promise<void>
}

interface PresenceViewer {
  membershipNumber: string
  displayName: string
  noteId: string | null
}

function yjsStorageKey(noteId: string) {
  return `yjs:${noteId}`
}

function contentTypeStorageKey(noteId: string) {
  return `content-type:${noteId}`
}

function contentHashStorageKey(noteId: string) {
  return `content-hash:${noteId}`
}

export class ProjectNoteRoom extends DurableObject<AppBindings> {
  private projectId: string | null = null
  private notes = new Map<string, NoteSession>()
  private pendingSqlNoteIds = new Set<string>()

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket upgrade.', { status: 426 })
    }

    const projectId = url.searchParams.get('projectId')?.trim() || null
    if (!projectId) {
      return new Response('Missing project id.', { status: 400 })
    }

    const membershipNumber = url.searchParams.get('membershipNumber')?.trim() || ''
    const displayName = url.searchParams.get('displayName')?.trim() || membershipNumber
    if (!membershipNumber) {
      return new Response('Missing membership number.', { status: 400 })
    }

    this.projectId = projectId
    await this.ctx.storage.put('project-id', projectId)

    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]

    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({
      membershipNumber,
      displayName,
      focusedNoteId: null,
      awarenessIds: [],
    } satisfies SocketAttachment)

    this.broadcastPresence()

    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    await this.ensureProjectId()

    const data = typeof message === 'string' ? new TextEncoder().encode(message) : new Uint8Array(message)
    const decoder = decoding.createDecoder(data)
    const messageType = decoding.readVarUint(decoder)

    switch (messageType) {
      case MESSAGE_CONTROL: {
        await this.handleControlMessage(ws, decoding.readVarString(decoder))
        break
      }
      case MESSAGE_SYNC: {
        const noteId = decoding.readVarString(decoder)
        const session = await this.ensureNoteSession(noteId)
        if (!session) {
          return
        }

        const headerEncoder = encoding.createEncoder()
        encoding.writeVarUint(headerEncoder, MESSAGE_SYNC)
        encoding.writeVarString(headerEncoder, noteId)
        const headerLength = encoding.toUint8Array(headerEncoder).length

        const responseEncoder = encoding.createEncoder()
        encoding.writeVarUint(responseEncoder, MESSAGE_SYNC)
        encoding.writeVarString(responseEncoder, noteId)
        syncProtocol.readSyncMessage(decoder, responseEncoder, session.doc, ws)
        const response = encoding.toUint8Array(responseEncoder)
        if (response.length > headerLength) {
          ws.send(response)
        }
        break
      }
      case MESSAGE_AWARENESS: {
        const noteId = decoding.readVarString(decoder)
        const session = await this.ensureNoteSession(noteId)
        if (!session) {
          return
        }

        const attachment = this.readAttachment(ws)
        if (!attachment || attachment.focusedNoteId !== noteId) {
          return
        }

        const update = decoding.readVarUint8Array(decoder)
        const controlledIds = new Set(attachment.awarenessIds)
        const before = new Set(session.awareness.getStates().keys())
        awarenessProtocol.applyAwarenessUpdate(session.awareness, update, ws)
        for (const clientId of session.awareness.getStates().keys()) {
          if (!before.has(clientId)) {
            controlledIds.add(clientId)
          }
        }
        this.writeAttachment(ws, {
          ...attachment,
          awarenessIds: Array.from(controlledIds),
        })
        break
      }
      default:
        break
    }
  }

  async webSocketClose(ws: WebSocket) {
    await this.removeClient(ws)
  }

  async webSocketError(ws: WebSocket) {
    await this.removeClient(ws)
  }

  async alarm() {
    await this.ensureProjectId()
    const pending = (await this.ctx.storage.get<string[]>('pending-sql-note-ids')) ?? [
      ...this.pendingSqlNoteIds,
    ]

    for (const noteId of pending) {
      const session = await this.ensureNoteSession(noteId)
      if (!session) {
        continue
      }
      await session.yjsPersistChain
      await this.persistSql(session)
    }

    this.pendingSqlNoteIds.clear()
    await this.ctx.storage.delete('pending-sql-note-ids')
  }

  private async handleControlMessage(ws: WebSocket, raw: string) {
    let payload: { type?: string; noteId?: string | null; contentType?: string }
    try {
      payload = JSON.parse(raw) as { type?: string; noteId?: string | null; contentType?: string }
    } catch {
      return
    }

    if (payload.type !== 'focus') {
      return
    }

    const attachment = this.readAttachment(ws)
    if (!attachment) {
      return
    }

    const nextNoteId = payload.noteId?.trim() || null
    const previousNoteId = attachment.focusedNoteId

    if (previousNoteId && previousNoteId !== nextNoteId) {
      const previous = this.notes.get(previousNoteId)
      if (previous && attachment.awarenessIds.length > 0) {
        awarenessProtocol.removeAwarenessStates(previous.awareness, attachment.awarenessIds, ws)
      }
    }

    if (nextNoteId) {
      const contentType: NoteContentType = payload.contentType === 'markdown' ? 'markdown' : 'html'
      await this.ctx.storage.put(contentTypeStorageKey(nextNoteId), contentType)
      const session = await this.ensureNoteSession(nextNoteId, contentType)
      if (!session) {
        return
      }

      this.writeAttachment(ws, {
        ...attachment,
        focusedNoteId: nextNoteId,
        awarenessIds: [],
      })

      this.sendSyncStep1(ws, session)
      this.sendAwarenessSnapshot(ws, session)
    } else {
      this.writeAttachment(ws, {
        ...attachment,
        focusedNoteId: null,
        awarenessIds: [],
      })
    }

    this.broadcastPresence()
  }

  private async ensureProjectId() {
    if (this.projectId) {
      return this.projectId
    }

    this.projectId = (await this.ctx.storage.get<string>('project-id')) ?? null
    return this.projectId
  }

  private async ensureNoteSession(noteId: string, contentTypeHint?: NoteContentType) {
    const existing = this.notes.get(noteId)
    if (existing) {
      if (contentTypeHint && existing.contentType !== contentTypeHint) {
        existing.contentType = contentTypeHint
        await this.ctx.storage.put(contentTypeStorageKey(noteId), contentTypeHint)
      }
      return existing
    }

    return this.ctx.blockConcurrencyWhile(async () => {
      const raced = this.notes.get(noteId)
      if (raced) {
        return raced
      }

      const storedType = await this.ctx.storage.get<string>(contentTypeStorageKey(noteId))
      const contentType: NoteContentType =
        contentTypeHint ??
        (storedType === 'markdown' ? 'markdown' : 'html')

      const doc = new Y.Doc()
      const awareness = new awarenessProtocol.Awareness(doc)
      const session: NoteSession = {
        noteId,
        contentType,
        doc,
        awareness,
        yjsPersistChain: Promise.resolve(),
      }

      const storedState = await this.ctx.storage.get<ArrayBuffer>(yjsStorageKey(noteId))
      if (storedState) {
        Y.applyUpdate(doc, new Uint8Array(storedState))
      }

      await this.ctx.storage.put(contentTypeStorageKey(noteId), contentType)

      doc.on('update', (update: Uint8Array, origin: unknown) => {
        this.broadcastNoteUpdate(session, update, origin)
        this.queueYjsPersist(session)
        this.scheduleSqlPersist(noteId)
      })

      awareness.on(
        'update',
        (
          { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
          origin: unknown,
        ) => {
          const changedClients = added.concat(updated).concat(removed)
          if (changedClients.length === 0) {
            return
          }

          const encoder = encoding.createEncoder()
          encoding.writeVarUint(encoder, MESSAGE_AWARENESS)
          encoding.writeVarString(encoder, noteId)
          encoding.writeVarUint8Array(
            encoder,
            awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients),
          )
          this.broadcastToNote(noteId, encoding.toUint8Array(encoder), origin)
        },
      )

      this.notes.set(noteId, session)
      return session
    })
  }

  private sendSyncStep1(socket: WebSocket, session: NoteSession) {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, MESSAGE_SYNC)
    encoding.writeVarString(encoder, session.noteId)
    syncProtocol.writeSyncStep1(encoder, session.doc)
    socket.send(encoding.toUint8Array(encoder))
  }

  private sendAwarenessSnapshot(socket: WebSocket, session: NoteSession) {
    const clientIds = Array.from(session.awareness.getStates().keys())
    if (clientIds.length === 0) {
      return
    }

    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS)
    encoding.writeVarString(encoder, session.noteId)
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(session.awareness, clientIds),
    )
    socket.send(encoding.toUint8Array(encoder))
  }

  private broadcastNoteUpdate(session: NoteSession, update: Uint8Array, origin: unknown) {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, MESSAGE_SYNC)
    encoding.writeVarString(encoder, session.noteId)
    syncProtocol.writeUpdate(encoder, update)
    this.broadcastToNote(session.noteId, encoding.toUint8Array(encoder), origin)
  }

  private broadcastToNote(noteId: string, message: Uint8Array, origin: unknown) {
    for (const socket of this.ctx.getWebSockets()) {
      if (socket === origin || socket.readyState !== WebSocket.OPEN) {
        continue
      }

      const attachment = this.readAttachment(socket)
      if (attachment?.focusedNoteId !== noteId) {
        continue
      }

      socket.send(message)
    }
  }

  private broadcastPresence(exclude?: WebSocket) {
    const viewers = this.collectPresenceViewers(exclude)
    const payload = JSON.stringify({ type: 'presence', viewers })
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, MESSAGE_CONTROL)
    encoding.writeVarString(encoder, payload)
    const message = encoding.toUint8Array(encoder)

    for (const socket of this.ctx.getWebSockets()) {
      if (socket === exclude || socket.readyState !== WebSocket.OPEN) {
        continue
      }
      socket.send(message)
    }
  }

  private collectPresenceViewers(exclude?: WebSocket): PresenceViewer[] {
    const byMember = new Map<string, PresenceViewer>()

    for (const socket of this.ctx.getWebSockets()) {
      if (socket === exclude) {
        continue
      }

      const attachment = this.readAttachment(socket)
      if (!attachment?.membershipNumber) {
        continue
      }

      byMember.set(attachment.membershipNumber, {
        membershipNumber: attachment.membershipNumber,
        displayName: attachment.displayName || attachment.membershipNumber,
        noteId: attachment.focusedNoteId,
      })
    }

    return [...byMember.values()]
  }

  private async removeClient(ws: WebSocket) {
    await this.ensureProjectId()
    const attachment = this.readAttachment(ws)
    const focusedNoteId = attachment?.focusedNoteId ?? null

    if (focusedNoteId && attachment && attachment.awarenessIds.length > 0) {
      const session = this.notes.get(focusedNoteId)
      if (session) {
        awarenessProtocol.removeAwarenessStates(session.awareness, attachment.awarenessIds, ws)
      }
    }

    if (attachment) {
      this.writeAttachment(ws, {
        ...attachment,
        focusedNoteId: null,
        awarenessIds: [],
      })
    }

    if (this.ctx.getWebSockets().length <= 1 && focusedNoteId) {
      const session = await this.ensureNoteSession(focusedNoteId)
      if (session) {
        await session.yjsPersistChain
        await this.persistYjsState(session)
        await this.persistSql(session)
      }
    }

    this.broadcastPresence(ws)
  }

  private readAttachment(ws: WebSocket): SocketAttachment | null {
    const value = ws.deserializeAttachment() as SocketAttachment | null
    if (!value?.membershipNumber) {
      return null
    }

    return {
      membershipNumber: value.membershipNumber,
      displayName: value.displayName || value.membershipNumber,
      focusedNoteId: value.focusedNoteId ?? null,
      awarenessIds: Array.isArray(value.awarenessIds) ? value.awarenessIds : [],
    }
  }

  private writeAttachment(ws: WebSocket, attachment: SocketAttachment) {
    ws.serializeAttachment(attachment)
  }

  private queueYjsPersist(session: NoteSession) {
    session.yjsPersistChain = session.yjsPersistChain
      .then(async () => {
        const state = Y.encodeStateAsUpdate(session.doc)
        await this.ctx.storage.put(yjsStorageKey(session.noteId), state)
      })
      .catch(() => {
        // Keep the chain alive after a failed write.
      })
  }

  private scheduleSqlPersist(noteId: string) {
    this.pendingSqlNoteIds.add(noteId)
    void this.ctx.storage.put('pending-sql-note-ids', [...this.pendingSqlNoteIds])
    void this.ctx.storage.setAlarm(Date.now() + SQL_PERSIST_DEBOUNCE_MS)
  }

  private async persistYjsState(session: NoteSession) {
    const state = Y.encodeStateAsUpdate(session.doc)
    await this.ctx.storage.put(yjsStorageKey(session.noteId), state)
  }

  private async persistSql(session: NoteSession) {
    let content: string
    let preview: string | null

    if (session.contentType === 'markdown') {
      const extracted = extractMarkdownNoteContent(session.doc)
      content = extracted.content
      preview = extracted.preview
    } else {
      const extracted = extractNoteContent(session.doc)
      content = extracted.html
      preview = extracted.preview
    }

    await updateProjectNoteContent(this.env.VMS_DB, session.noteId, content, preview)
    void this.queueNoteVectorReindex(session.noteId, session.contentType, content)
  }

  private async queueNoteVectorReindex(
    noteId: string,
    contentType: NoteContentType,
    content: string,
  ) {
    try {
      const projectId = this.projectId ?? (await this.ctx.storage.get<string>('project-id'))
      if (!projectId) {
        return
      }

      const previousContentHash =
        (await this.ctx.storage.get<string>(contentHashStorageKey(noteId))) ?? null
      const nextHash = await hashNoteContent(content)
      if (previousContentHash && previousContentHash === nextHash) {
        return
      }

      const note = await getProjectNoteById(this.env.VMS_DB, noteId)
      const title = note?.title?.trim() || noteId

      const result = await reindexNoteVectors(this.env, {
        projectId,
        noteId,
        title,
        contentType,
        content,
        previousContentHash,
      })

      if (!result.skipped) {
        await this.ctx.storage.put(contentHashStorageKey(noteId), result.contentHash)
      }
    } catch (error) {
      console.warn(`Failed to reindex note vectors for ${noteId}`, error)
    }
  }
}

export type ProjectNoteRoomStub = DurableObjectStub<ProjectNoteRoom>
