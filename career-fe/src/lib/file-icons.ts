import type { LucideIcon } from 'lucide-react'
import {
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType,
  FileVideo,
  Presentation,
} from 'lucide-react'

export type FileIconInfo = {
  Icon: LucideIcon
  label: string
  tone: string
  bg: string
}

function extensionOf(fileName: string) {
  const base = fileName.split(/[\\/]/).pop() || fileName
  const dot = base.lastIndexOf('.')
  if (dot < 0) return ''
  return base.slice(dot + 1).toLowerCase()
}

export function resolveFileIcon(
  fileName: string,
  contentType?: string | null,
): FileIconInfo {
  const ext = extensionOf(fileName)
  const mime = String(contentType || '').toLowerCase()

  if (ext === 'pdf' || mime === 'application/pdf') {
    return { Icon: FileText, label: 'PDF', tone: 'text-rose-700', bg: 'bg-rose-50' }
  }

  if (
    ['doc', 'docx'].includes(ext) ||
    mime.includes('msword') ||
    mime.includes('wordprocessingml')
  ) {
    return { Icon: FileType, label: 'Word', tone: 'text-sky-700', bg: 'bg-sky-50' }
  }

  if (
    ['xls', 'xlsx', 'csv'].includes(ext) ||
    mime.includes('spreadsheetml') ||
    mime.includes('excel') ||
    mime === 'text/csv'
  ) {
    return { Icon: FileSpreadsheet, label: 'Excel', tone: 'text-emerald-700', bg: 'bg-emerald-50' }
  }

  if (
    ['ppt', 'pptx'].includes(ext) ||
    mime.includes('presentationml') ||
    mime.includes('powerpoint')
  ) {
    return { Icon: Presentation, label: 'PowerPoint', tone: 'text-orange-700', bg: 'bg-orange-50' }
  }

  if (
    ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext) ||
    mime.startsWith('image/')
  ) {
    return { Icon: FileImage, label: 'صورة', tone: 'text-violet-700', bg: 'bg-violet-50' }
  }

  if (
    ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) ||
    mime.includes('zip') ||
    mime.includes('compressed') ||
    mime.includes('tar')
  ) {
    return { Icon: FileArchive, label: 'أرشيف', tone: 'text-amber-700', bg: 'bg-amber-50' }
  }

  if (
    ['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(ext) ||
    mime.startsWith('video/')
  ) {
    return { Icon: FileVideo, label: 'فيديو', tone: 'text-indigo-700', bg: 'bg-indigo-50' }
  }

  if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext) || mime.startsWith('audio/')) {
    return { Icon: FileAudio, label: 'صوت', tone: 'text-teal-700', bg: 'bg-teal-50' }
  }

  if (['txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts'].includes(ext) || mime.startsWith('text/')) {
    return { Icon: FileCode, label: 'نص', tone: 'text-slate-700', bg: 'bg-slate-100' }
  }

  return { Icon: File, label: 'ملف', tone: 'text-slate-600', bg: 'bg-slate-100' }
}

export function formatFileSize(bytes?: number | null) {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function documentKindLabel(kind?: string | null) {
  if (kind === 'cv') return 'سيرة ذاتية'
  if (kind === 'portfolio') return 'ملف أعمال'
  return 'مرفق'
}
