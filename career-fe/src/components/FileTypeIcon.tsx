import { resolveFileIcon } from '../lib/file-icons'

type Props = {
  fileName: string
  contentType?: string | null
  size?: 'sm' | 'md'
  showLabel?: boolean
}

export function FileTypeIcon({
  fileName,
  contentType,
  size = 'md',
  showLabel = false,
}: Props) {
  const { Icon, label, tone, bg } = resolveFileIcon(fileName, contentType)
  const box = size === 'sm' ? 'h-9 w-9' : 'h-11 w-11'
  const icon = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'

  return (
    <div className="flex shrink-0 items-center gap-2">
      <span
        className={`inline-flex ${box} items-center justify-center rounded-md border border-line ${bg} ${tone}`}
        title={label}
        aria-hidden
      >
        <Icon className={icon} strokeWidth={1.75} />
      </span>
      {showLabel ? (
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </span>
      ) : null}
    </div>
  )
}
