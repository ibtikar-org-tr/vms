import type { ReactNode } from 'react'

export type CvMapItem = {
  id: string
  label: string
  icon?: ReactNode
}

type Props = {
  items: CvMapItem[]
  activeId: string | null
  onNavigate: (id: string) => void
  onHover?: (id: string) => void
}

export function CvSectionMap({ items, activeId, onNavigate, onHover }: Props) {
  if (!items.length) return null

  return (
    <nav className="cv-toc print:hidden" aria-label="خريطة أقسام السيرة">
      <div className="cv-toc-card">
        <ol className="cv-toc-list">
          {items.map((item) => {
            const active = activeId === item.id
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`cv-toc-link ${active ? 'is-active' : ''}`}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => onNavigate(item.id)}
                  onMouseEnter={() => onHover?.(item.id)}
                >
                  {item.icon ? <span className="cv-toc-icon">{item.icon}</span> : null}
                  <span>{item.label}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>
    </nav>
  )
}
