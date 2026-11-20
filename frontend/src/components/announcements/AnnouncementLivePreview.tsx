import { ImagePlus, X } from 'lucide-react'
import { useId, useState } from 'react'
import { uploadImages } from '../../api/vms'

export function AnnouncementImageField({
  imageUrl,
  onChange,
  disabled,
}: {
  imageUrl: string | null
  onChange: (url: string | null) => void
  disabled?: boolean
}) {
  const inputId = useId()
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setIsUploading(true)
    try {
      const uploaded = await uploadImages([file])
      const url = uploaded.images[0]?.trim()
      if (!url) {
        throw new Error('تعذر رفع الصورة.')
      }
      onChange(url)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذر رفع الصورة.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-slate-700">صورة مرفقة (اختياري)</span>
      {imageUrl ? (
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
          <img src={imageUrl} alt="" className="h-14 w-20 rounded object-cover" />
          <p className="min-w-0 flex-1 text-xs leading-5 text-slate-600">ستظهر في المعاينة والبريد وتيليغرام.</p>
          <button
            type="button"
            disabled={disabled || isUploading}
            onClick={() => onChange(null)}
            className="rounded p-1 text-slate-500 hover:text-red-600 disabled:opacity-50"
            aria-label="إزالة الصورة"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-600 hover:border-cyan-600"
        >
          <ImagePlus className="h-4 w-4 text-cyan-700" />
          {isUploading ? 'جارٍ رفع الصورة...' : 'إرفاق صورة'}
        </label>
      )}
      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        disabled={disabled || isUploading}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          void handleFile(file)
        }}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}

export function AnnouncementLivePreview({
  kind,
  subject,
  body,
  imageUrl,
  eventName,
}: {
  kind: 'assembly' | 'event'
  subject: string
  body: string
  imageUrl?: string | null
  eventName?: string
}) {
  const eventLabel = eventName?.trim() || 'الفعالية'
  const kicker = kind === 'assembly' ? 'رسالة من مجلس الإدارة إلى أعضاء التجمّع' : `رسالة للمسجّلين في ${eventLabel}`
  const greeting = kind === 'assembly' ? 'السلام عليكم عضو تجمّع إبتكار،' : 'السلام عليكم،'

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
      <div className="bg-linear-to-l from-cyan-800 to-teal-700 px-5 py-4 text-white">
        <p className="text-[11px] font-bold tracking-wide text-cyan-100">تجمّع إبتكار</p>
        <h3 className="mt-1 text-lg font-extrabold">{subject.trim() || 'عنوان الرسالة'}</h3>
        <p className="mt-1 text-xs text-cyan-100">{kicker}</p>
      </div>
      {imageUrl ? <img src={imageUrl} alt="" className="max-h-56 w-full object-cover" /> : null}
      <div className="space-y-3 bg-white px-5 py-4 text-sm leading-7 text-slate-700">
        <p>{greeting}</p>
        <p className="whitespace-pre-wrap">{body.trim() || 'سيظهر نص الرسالة هنا مع التوقيع.'}</p>
        <div className="border-t border-slate-100 pt-3 text-center text-xs text-slate-500">
          {kind === 'assembly' ? (
            <>
              <p className="font-extrabold text-teal-700">مجلس الإدارة</p>
              <p className="font-semibold text-slate-700">تجمّع إبتكار</p>
            </>
          ) : (
            <>
              <p className="font-extrabold text-teal-700">{eventLabel}</p>
              <p className="font-semibold text-slate-700">تجمّع إبتكار</p>
            </>
          )}
          <p>vms.ibtikar.tr</p>
        </div>
      </div>
    </div>
  )
}
