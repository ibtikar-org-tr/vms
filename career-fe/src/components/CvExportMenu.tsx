import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  Copy,
  Download,
  FileDown,
  FileText,
  Palette,
  Type,
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { CvDocumentData } from './CvDocument'
import type { CvPdfStyle } from '../lib/cv-pdf'

type Props = {
  data: CvDocumentData
}

export function CvExportMenu({ data }: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const run = async (key: string, action: () => Promise<void>, ok: string) => {
    setBusy(key)
    try {
      await action()
      toast.success(ok)
      setOpen(false)
    } catch (error) {
      console.error(error)
      toast.error('تعذّر إتمام التصدير')
    } finally {
      setBusy(null)
    }
  }

  const downloadPdf = (style: CvPdfStyle) =>
    run(
      `pdf-${style}`,
      async () => {
        const { downloadCvPdf } = await import('../lib/cv-pdf')
        await downloadCvPdf(data, style)
      },
      style === 'modern' ? 'تم تنزيل PDF الحديث' : 'تم تنزيل PDF القياسي',
    )

  const withText = async () => {
    const mod = await import('../lib/cv-export-text')
    return mod
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="btn-primary py-2 text-xs sm:text-sm"
        disabled={Boolean(busy)}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <FileDown className="h-4 w-4" />
        {busy ? 'جاري التصدير…' : 'تصدير السيرة'}
        <ChevronDown className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div className="absolute end-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-white shadow-sheet">
          <div className="border-b border-line bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-bold text-slate-700">PDF</p>
          </div>
          <div className="p-1.5">
            <button
              type="button"
              className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-start transition hover:bg-slate-50 disabled:opacity-50"
              disabled={Boolean(busy)}
              onClick={() => void downloadPdf('standard')}
            >
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              <span>
                <span className="block text-sm font-semibold text-slate-900">PDF قياسي</span>
                <span className="block text-[11px] text-slate-500">
                  تخطيط ATS نظيف وأحادي اللون تقريباً
                </span>
              </span>
              <Download className="ms-auto mt-0.5 h-3.5 w-3.5 text-slate-400" />
            </button>
            <button
              type="button"
              className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-start transition hover:bg-slate-50 disabled:opacity-50"
              disabled={Boolean(busy)}
              onClick={() => void downloadPdf('modern')}
            >
              <Palette className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>
                <span className="block text-sm font-semibold text-slate-900">PDF حديث</span>
                <span className="block text-[11px] text-slate-500">
                  ألوان المنصة + صورة شخصية + شريط جانبي
                </span>
              </span>
              <Download className="ms-auto mt-0.5 h-3.5 w-3.5 text-slate-400" />
            </button>
          </div>

          <div className="border-y border-line bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-bold text-slate-700">Markdown</p>
          </div>
          <div className="grid grid-cols-2 gap-1 p-1.5">
            <button
              type="button"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              disabled={Boolean(busy)}
              onClick={() =>
                void run(
                  'md-dl',
                  async () => {
                    const { buildCvMarkdown, cvExportBaseName, downloadTextFile } = await withText()
                    downloadTextFile(
                      `${cvExportBaseName(data)}.md`,
                      buildCvMarkdown(data),
                      'text/markdown',
                    )
                  },
                  'تم تنزيل Markdown',
                )
              }
            >
              <Download className="h-3.5 w-3.5" />
              تنزيل
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              disabled={Boolean(busy)}
              onClick={() =>
                void run(
                  'md-copy',
                  async () => {
                    const { buildCvMarkdown, copyText } = await withText()
                    await copyText(buildCvMarkdown(data))
                  },
                  'تم نسخ Markdown',
                )
              }
            >
              <Copy className="h-3.5 w-3.5" />
              نسخ
            </button>
          </div>

          <div className="border-y border-line bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-bold text-slate-700">نص عادي (TXT)</p>
          </div>
          <div className="grid grid-cols-2 gap-1 p-1.5">
            <button
              type="button"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              disabled={Boolean(busy)}
              onClick={() =>
                void run(
                  'txt-dl',
                  async () => {
                    const { buildCvPlainText, cvExportBaseName, downloadTextFile } = await withText()
                    downloadTextFile(
                      `${cvExportBaseName(data)}.txt`,
                      buildCvPlainText(data),
                      'text/plain',
                    )
                  },
                  'تم تنزيل TXT',
                )
              }
            >
              <Download className="h-3.5 w-3.5" />
              تنزيل
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              disabled={Boolean(busy)}
              onClick={() =>
                void run(
                  'txt-copy',
                  async () => {
                    const { buildCvPlainText, copyText } = await withText()
                    await copyText(buildCvPlainText(data))
                  },
                  'تم نسخ النص',
                )
              }
            >
              <Type className="h-3.5 w-3.5" />
              نسخ
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
