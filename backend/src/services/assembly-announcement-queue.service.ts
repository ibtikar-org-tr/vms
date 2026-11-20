import type { AppBindings, AssemblyAnnouncementQueueMessage, QueueMessageBatchLike } from '../types/bindings'
import { announcementNeedsContinue, deliverAssemblyAnnouncement, enqueueAnnouncementDelivery } from './assembly-announcement.service'
import { updateAssemblyAnnouncementProgress } from '../repositories/assembly-announcements.repository'
import {
  deliverEventAnnouncement,
  enqueueEventAnnouncementDelivery,
  eventAnnouncementNeedsContinue,
} from './event-announcement.service'
import { updateEventAnnouncementProgress } from '../repositories/event-announcements.repository'

export async function handleAssemblyAnnouncementQueue(
  batch: QueueMessageBatchLike<AssemblyAnnouncementQueueMessage>,
  env: AppBindings,
) {
  for (const message of batch.messages) {
    const announcementId = message.body?.announcementId?.trim()
    if (!announcementId) {
      message.ack()
      continue
    }

    const kind = message.body?.kind === 'event' ? 'event' : 'assembly'

    try {
      if (kind === 'event') {
        const announcement = await deliverEventAnnouncement(env, announcementId)
        if (!announcement) {
          message.ack()
          continue
        }

        const needsMore = await eventAnnouncementNeedsContinue(env, announcement)
        if (needsMore) {
          const queued = await enqueueEventAnnouncementDelivery(env, announcementId, 2)
          if (!queued) {
            throw new Error('طابور الإرسال غير متاح لمتابعة الرسالة.')
          }
        }

        message.ack()
        continue
      }

      const announcement = await deliverAssemblyAnnouncement(env, announcementId)
      if (!announcement) {
        message.ack()
        continue
      }

      const needsMore = await announcementNeedsContinue(env, announcement)
      if (needsMore) {
        const queued = await enqueueAnnouncementDelivery(env, announcementId, 2)
        if (!queued) {
          throw new Error('طابور الإرسال غير متاح لمتابعة الرسالة.')
        }
      }

      message.ack()
    } catch (error) {
      console.error('Failed to process announcement queue message', {
        kind,
        announcementId,
        attempts: message.attempts,
        error,
      })

      if ((message.attempts ?? 1) >= 6) {
        if (kind === 'event') {
          await updateEventAnnouncementProgress(env.VMS_DB, announcementId, {
            lastError: 'توقف الإرسال في الطابور. اضغط متابعة الإرسال.',
          }).catch(() => undefined)
        } else {
          await updateAssemblyAnnouncementProgress(env.VMS_DB, announcementId, {
            lastError: 'توقف الإرسال في الطابور. اضغط متابعة الإرسال.',
          }).catch(() => undefined)
        }
        message.ack()
        continue
      }

      message.retry({ delaySeconds: Math.min(60, 8 * (message.attempts ?? 1)) })
    }
  }
}
