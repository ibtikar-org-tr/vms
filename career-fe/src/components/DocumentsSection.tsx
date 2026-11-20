import { DragEvent, useRef, useState } from 'react'
import { Download, Loader2, Trash2, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { FileTypeIcon } from './FileTypeIcon'
import {
  documentKindLabel,
  formatFileSize,
} from '../lib/file-icons'
import { authDownloadHeaders, profilesApi } from '../services/api'

export type ProfileDocument = {
  id: string
  file_name: string
  kind?: string
  content_type?: string | null
  size_bytes?: number | null
  created_at?: string | null
}

type Props = {
  documents: ProfileDocument[]
  onChanged: () => Promise<void> | void
}

const ACCEPT = '.pdf,.doc,.docx,image/png,image/jpeg,image/webp,image/gif'

type UploadKind = 'cv' | 'portfolio'

async function downloadDocument(doc: ProfileDocument) {
  const res = await fetch(profilesApi.documentDownloadUrl(doc.id), {
    headers: authDownloadHeaders(),
  })
  if (!res.ok) throw new Error('download failed')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = doc.file_name
  a.click()
  URL.revokeObjectURL(url)
}

function UploadCard({
  kind,
  title,
  hint,
  uploading,
  onPick,
}: {
  kind: UploadKind
  title: string
  hint: string
  uploading: boolean
  onPick: (file: File, kind: UploadKind) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const takeFile = (file: File | undefined | null) => {
    if (!file || uploading) return
    onPick(file, kind)
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragOver(false)
    takeFile(event.dataTransfer.files?.[0])
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={`rounded-lg border border-dashed p-4 transition outline-none sm:p-5 ${
        dragOver
          ? 'border-brand bg-brand-light/50'
          : 'border-slate-300 bg-slate-50/80 hover:border-slate-400 hover:bg-slate-100/70'
      } ${uploading ? 'pointer-events-none opacity-70' : 'cursor-pointer'}`}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          inputRef.current?.click()
        }
      }}
      onDragEnter={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        setDragOver(false)
      }}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={ACCEPT}
        disabled={uploading}
        onChange={(e) => {
          takeFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line bg-white text-brand">
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900">
            {uploading ? 'جارٍ الرفع…' : title}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{hint}</p>
          <p className="mt-2 text-[11px] font-medium text-slate-400">
            PDF · Word · صور — اسحب الملف هنا أو انقر للاختيار
          </p>
        </div>
      </div>
    </div>
  )
}

export function DocumentsSection({ documents, onChanged }: Props) {
  const [uploadingKind, setUploadingKind] = useState<UploadKind | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const upload = async (file: File, kind: UploadKind) => {
    setUploadingKind(kind)
    try {
      await profilesApi.uploadDocument(file, kind)
      toast.success('تم رفع الملف')
      await onChanged()
    } catch {
      toast.error('تعذّر رفع الملف')
    } finally {
      setUploadingKind(null)
    }
  }

  const remove = async (doc: ProfileDocument) => {
    setBusyId(doc.id)
    try {
      await profilesApi.deleteDocument(doc.id)
      toast.success('تم الحذف')
      await onChanged()
    } catch {
      toast.error('تعذّر حذف الملف')
    } finally {
      setBusyId(null)
    }
  }

  const download = async (doc: ProfileDocument) => {
    setBusyId(doc.id)
    try {
      await downloadDocument(doc)
    } catch {
      toast.error('تعذّر تنزيل الملف')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <UploadCard
          kind="cv"
          title="رفع سيرة ذاتية"
          hint="ارفع نسخة PDF أو Word من سيرتك الذاتية."
          uploading={uploadingKind === 'cv'}
          onPick={upload}
        />
        <UploadCard
          kind="portfolio"
          title="رفع ملف أعمال"
          hint="نماذج أعمال، شهادات، أو ملف تعريفي إضافي."
          uploading={uploadingKind === 'portfolio'}
          onPick={upload}
        />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-800">الملفات المرفوعة</h3>
          <span className="text-xs text-slate-400">{documents.length} ملف</span>
        </div>

        {!documents.length ? (
          <p className="rounded-lg border border-dashed border-line bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-400">
            لا توجد ملفات بعد. استخدم أحد مربعات الرفع أعلاه.
          </p>
        ) : (
          <ul className="space-y-2">
            {documents.map((doc) => {
              const size = formatFileSize(doc.size_bytes)
              const busy = busyId === doc.id
              return (
                <li
                  key={doc.id}
                  className="flex flex-col gap-3 rounded-lg border border-line bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <FileTypeIcon
                      fileName={doc.file_name}
                      contentType={doc.content_type}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900" title={doc.file_name}>
                        {doc.file_name}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                        <span>{documentKindLabel(doc.kind)}</span>
                        {size ? <span>· {size}</span> : null}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2 self-stretch sm:self-auto">
                    <button
                      type="button"
                      className="btn-ghost flex-1 py-1.5 text-xs sm:flex-none"
                      disabled={busy}
                      onClick={() => void download(doc)}
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      تنزيل
                    </button>
                    <button
                      type="button"
                      className="btn-danger flex-1 py-1.5 text-xs sm:flex-none"
                      disabled={busy}
                      onClick={() => void remove(doc)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      حذف
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
