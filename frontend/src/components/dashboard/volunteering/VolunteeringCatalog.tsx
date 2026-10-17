import { useMemo, useState } from 'react'
import { HeartHandshake, Search } from 'lucide-react'
import type { VmsPosition } from '../../../types/vms'
import { normalizeToAsciiLower } from '../../../utils/normalizeText'
import { VolunteeringPositionCard } from './VolunteeringPositionCard'

function getUserApplication(position: VmsPosition, membershipNumber?: string) {
  if (!membershipNumber) {
    return null
  }

  return position.applications.find((application) => application.membershipNumber === membershipNumber) ?? null
}

export function VolunteeringCatalog({
  positions,
  membershipNumber,
  applyingPositionId,
  cancellingPositionId,
  onApply,
  onCancel,
  emptyMessage,
}: {
  positions: VmsPosition[]
  membershipNumber?: string
  applyingPositionId: string | null
  cancellingPositionId: string | null
  onApply: (positionId: string) => void
  onCancel: (positionId: string, applicationId: string) => void
  emptyMessage: string
}) {
  const [query, setQuery] = useState('')
  const [projectFilter, setProjectFilter] = useState('all')

  const normalizedQuery = normalizeToAsciiLower(query.trim())

  const projectOptions = useMemo(() => {
    return Array.from(
      new Set(positions.map((position) => (position.projectName ?? position.projectId).trim()).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b))
  }, [positions])

  const filteredPositions = useMemo(() => {
    return positions.filter((position) => {
      const projectLabel = position.projectName ?? position.projectId
      const matchesProject = projectFilter === 'all' || projectLabel === projectFilter
      const matchesSearch =
        !normalizedQuery ||
        normalizeToAsciiLower(position.name).includes(normalizedQuery) ||
        normalizeToAsciiLower(position.description ?? '').includes(normalizedQuery) ||
        normalizeToAsciiLower(projectLabel).includes(normalizedQuery)

      return matchesProject && matchesSearch
    })
  }, [positions, projectFilter, normalizedQuery])

  const appliedPositions = useMemo(
    () => filteredPositions.filter((position) => Boolean(getUserApplication(position, membershipNumber))),
    [filteredPositions, membershipNumber],
  )

  const availablePositions = useMemo(
    () => filteredPositions.filter((position) => !getUserApplication(position, membershipNumber)),
    [filteredPositions, membershipNumber],
  )

  const renderPositionGrid = (items: VmsPosition[]) => (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((position) => {
        const userApplication = getUserApplication(position, membershipNumber)

        return (
          <VolunteeringPositionCard
            key={position.id}
            position={position}
            userApplication={userApplication}
            isApplying={applyingPositionId === position.id}
            isCancelling={cancellingPositionId === position.id}
            onApply={() => onApply(position.id)}
            onCancel={() => {
              if (userApplication) {
                onCancel(position.id, userApplication.id)
              }
            }}
          />
        )
      })}
    </div>
  )

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-linear-to-b from-white to-slate-50 p-4 shadow-xs">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-800">تصفية الفرص</p>
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
            {filteredPositions.length} نتيجة
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="relative block">
            <Search className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث باسم الفرصة أو المشروع"
              className="w-full rounded-md border border-slate-300 bg-white py-2 pr-9 pl-3 text-sm text-slate-800 outline-none focus:border-emerald-600"
            />
          </label>
          <select
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-600"
          >
            <option value="all">كل المشاريع</option>
            {projectOptions.map((project) => (
              <option key={project} value={project}>
                {project}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredPositions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-14 text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400">
            <HeartHandshake className="h-7 w-7" aria-hidden />
          </span>
          <p className="mt-4 text-sm font-medium text-slate-800">{emptyMessage}</p>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
            جرّب تعديل البحث أو راجع الصفحة لاحقاً عند إضافة فرص جديدة.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900 sm:text-base">فرصك المقدّم عليها</h3>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                {appliedPositions.length} فرصة
              </span>
            </div>
            {appliedPositions.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                لم تتقدّم على أي فرصة بعد. استكشف الفرص المتاحة أدناه.
              </p>
            ) : (
              renderPositionGrid(appliedPositions)
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900 sm:text-base">فرص متاحة للتقديم</h3>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-700">
                {availablePositions.length} فرصة
              </span>
            </div>
            {availablePositions.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                لا توجد فرص إضافية متاحة ضمن نتائج البحث الحالية.
              </p>
            ) : (
              renderPositionGrid(availablePositions)
            )}
          </section>
        </div>
      )}
    </div>
  )
}
