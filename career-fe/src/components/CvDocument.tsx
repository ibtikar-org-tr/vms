import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AlignLeft,
  Briefcase,
  Calendar,
  ChevronDown,
  Download,
  FolderKanban,
  GraduationCap,
  Languages,
  Mail,
  MapPin,
  MapPinned,
  Phone,
  UserRound,
} from 'lucide-react'
import { CvSectionMap, type CvMapItem } from './CvSectionMap'
import { FileTypeIcon } from './FileTypeIcon'
import { documentKindLabel } from '../lib/file-icons'
import {
  displayNameOf,
  formatBirthDate,
  formatDateRange,
  formatLocation,
  latestRoleOf,
  sexLabel,
  splitCsv,
} from '../lib/profile-utils'
import {
  formatSalaryRange,
  jobTypeLabel,
  locationLabel,
  normalizeWorkPreferences,
  type OpenJobType,
} from '../lib/work-preferences'
import { CvExportMenu } from './CvExportMenu'

export type CvSkill = { skillId?: string; name: string }

export type CvDocumentData = {
  profile: {
    membership_number: string
    summary?: string | null
    is_published?: boolean
  }
  vmsProfile?: {
    arName?: string | null
    enName?: string | null
    email?: string | null
    phoneNumber?: string | null
    sex?: string | null
    dateOfBirth?: string | null
    country?: string | null
    region?: string | null
    city?: string | null
    profilePictureUrl?: string | null
    educationLevel?: string | null
    fieldOfStudy?: string | null
    school?: string | null
    graduationYear?: number | string | null
    skills?: string | null
    interests?: string | null
    languages?: string | null
  } | null
  workExperiences?: Array<{
    id: string
    title?: string
    company_name?: string
    location?: string | null
    start_date?: string | null
    end_date?: string | null
    is_current?: boolean
    responsibilities?: string | null
    description?: string | null
    achievements?: string | null
    skills?: CvSkill[]
  }>
  projects?: Array<{
    id: string
    name?: string
    role?: string | null
    company?: string | null
    start_date?: string | null
    end_date?: string | null
    is_ongoing?: boolean
    responsibilities?: string | null
    outcomes?: string | null
    skills?: CvSkill[]
  }>
  documents?: Array<{
    id: string
    file_name: string
    kind?: string
    content_type?: string | null
    size_bytes?: number | null
  }>
  languages?: Array<{
    language: string
    proficiency?: number | null
    openToTranslate?: boolean
  }>
  workPreferences?: {
    canRelocate?: boolean
    relocateNotes?: string | null
    jobTypes?: Array<'full_time' | 'part_time' | 'temp_full_time' | string>
    locations?: Array<{
      kind: 'remote' | 'country' | string
      countryName?: string | null
      salaryMin?: number | null
      salaryMax?: number | null
      currency?: string
    }>
  }
}

type Props = {
  data: CvDocumentData
  onDownloadDocument?: (doc: NonNullable<CvDocumentData['documents']>[number]) => void
  compact?: boolean
  /** limited = privacy-redacted public view (no export / downloads / photo) */
  privacyMode?: 'full' | 'limited'
}

function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="text-sm text-slate-400">{children}</p>
}

function CollapsibleCvSection({
  id,
  title,
  icon,
  children,
  open,
  onOpenChange,
  onHover,
}: {
  id: string
  title: string
  icon?: ReactNode
  children: ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
  onHover?: () => void
}) {
  return (
    <section
      id={id}
      className="cv-collapse scroll-mt-24"
      onMouseEnter={onHover}
    >
      <div className="cv-section-title">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          {icon}
          {title}
        </span>
        <button
          type="button"
          className="cv-collapse-toggle print:hidden"
          aria-expanded={open}
          aria-label={open ? `إخفاء ${title}` : `إظهار ${title}`}
          onClick={() => onOpenChange(!open)}
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-300 ease-out ${
              open ? 'rotate-180' : 'rotate-0'
            }`}
          />
        </button>
      </div>
      <div className={`cv-collapse-panel ${open ? 'is-open' : ''}`} aria-hidden={!open}>
        <div className="cv-collapse-panel-inner">{children}</div>
      </div>
    </section>
  )
}

export function CvDocument({
  data,
  onDownloadDocument,
  compact,
  privacyMode = 'full',
}: Props) {
  const limited = privacyMode === 'limited'
  const vms = data.vmsProfile
  const name = displayNameOf(data)
  const role = latestRoleOf(data.workExperiences)
  const skills = splitCsv(vms?.skills)
  const interests = splitCsv(vms?.interests)
  const languages =
    data.languages?.length
      ? data.languages
      : splitCsv(vms?.languages).map((language) => ({
          language,
          proficiency: null as number | null,
          openToTranslate: false,
        }))
  const location = formatLocation(
    { country: vms?.country, region: vms?.region, city: vms?.city },
    '، ',
  )
  const birthDate = formatBirthDate(vms?.dateOfBirth)
  const sex = sexLabel(vms?.sex)
  const workPreferences = normalizeWorkPreferences(data.workPreferences)
  const educationBits = [vms?.educationLevel, vms?.fieldOfStudy].filter(Boolean).join(' · ')
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => Array.from(part.replace(/\./g, ''))[0] || '')
    .filter(Boolean)
    .join('')

  const showEmail = !limited && Boolean(vms?.email)
  const showPhone = !limited && Boolean(vms?.phoneNumber)
  const showPhoto = !limited && Boolean(vms?.profilePictureUrl)
  const canDownload = !limited && Boolean(onDownloadDocument)

  const hasPersonal = Boolean(
    showEmail || showPhone || location || birthDate || sex,
  )
  const hasWorkPrefs =
    workPreferences.canRelocate ||
    workPreferences.jobTypes.length > 0 ||
    workPreferences.locations.length > 0

  // Main content column only (not the right sidebar).
  const mapItems = useMemo(() => {
    const iconCls = 'h-3.5 w-3.5'
    const items: CvMapItem[] = []
    if (data.profile.summary) {
      items.push({
        id: 'cv-summary',
        label: 'نبذة مهنية',
        icon: <AlignLeft className={iconCls} />,
      })
    }
    if (hasWorkPrefs) {
      items.push({
        id: 'cv-work-prefs',
        label: 'تفضيلات العمل',
        icon: <MapPinned className={iconCls} />,
      })
    }
    items.push({
      id: 'cv-experience',
      label: 'الخبرة العملية',
      icon: <Briefcase className={iconCls} />,
    })
    items.push({
      id: 'cv-education',
      label: 'التعليم',
      icon: <GraduationCap className={iconCls} />,
    })
    items.push({
      id: 'cv-projects',
      label: 'المشاريع',
      icon: <FolderKanban className={iconCls} />,
    })
    if (data.documents?.length) {
      items.push({
        id: 'cv-documents',
        label: 'الملفات المرفقة',
        icon: <Download className={iconCls} />,
      })
    }
    return items
  }, [data.documents?.length, data.profile.summary, hasWorkPrefs])

  const [openMap, setOpenMap] = useState<Record<string, boolean>>({})
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    setOpenMap((prev) => {
      const next = { ...prev }
      for (const item of mapItems) {
        if (next[item.id] === undefined) next[item.id] = true
      }
      return next
    })
    setActiveId((prev) => prev ?? mapItems[0]?.id ?? null)
  }, [mapItems])

  const setSectionOpen = (id: string, open: boolean) => {
    setOpenMap((prev) => ({ ...prev, [id]: open }))
  }

  const hoverSection = (id: string) => {
    setActiveId(id)
  }

  const navigateToSection = (id: string) => {
    setActiveId(id)
    setSectionOpen(id, true)
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  return (
    <div className="cv-shell">
    <article
      id="cv-top"
      className={`cv-doc overflow-hidden rounded-lg border border-line bg-white scroll-mt-24 ${
        compact ? '' : 'print:shadow-none'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <img
            src="/career-mark.svg"
            alt=""
            className="h-7 w-7 shrink-0 rounded-md object-cover ring-1 ring-line sm:h-8 sm:w-8"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink">المسار المهني</p>
            <p className="truncate text-[11px] text-muted">
              {limited ? 'عرض محدود للخصوصية' : 'تصدير PDF · Markdown · TXT'}
            </p>
          </div>
        </div>
        {!limited ? <CvExportMenu data={data} /> : null}
      </div>

      <div className={`grid gap-0 lg:grid-cols-[230px_1fr] ${compact ? '' : 'lg:min-h-[640px]'}`}>
        <aside className="border-b border-line bg-[#f7f8fa] p-5 sm:p-6 lg:border-b-0 lg:border-l lg:border-line">
          <div className="flex flex-col items-center text-center lg:items-stretch lg:text-start">
            {showPhoto ? (
              <img
                src={vms!.profilePictureUrl!}
                alt=""
                className="mx-auto h-28 w-28 rounded-md object-cover ring-1 ring-line lg:mx-0"
              />
            ) : (
              <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-md bg-brand-light text-3xl font-bold text-brand-ink lg:mx-0">
                {initials || '؟'}
              </div>
            )}

            <div className="mt-4 lg:hidden">
              <h1 className="text-2xl font-bold text-ink">{name}</h1>
              {role ? <p className="mt-1 font-medium text-brand">{role}</p> : null}
            </div>
          </div>

          <div className="mt-6 space-y-4 text-sm">
            {hasPersonal ? (
              <CollapsibleCvSection
                id="cv-personal"
                title={limited ? 'معلومات شخصية' : 'تواصل ومعلومات شخصية'}
                open={openMap['cv-personal'] !== false}
                onOpenChange={(open) => setSectionOpen('cv-personal', open)}
              >
                <ul className="space-y-2.5 text-slate-600">
                  {showEmail ? (
                    <li className="flex items-start gap-2 break-all">
                      <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span dir="ltr">{vms?.email}</span>
                    </li>
                  ) : null}
                  {showPhone ? (
                    <li className="flex items-start gap-2">
                      <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span dir="ltr">{vms?.phoneNumber}</span>
                    </li>
                  ) : null}
                  {location ? (
                    <li className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span>{location}</span>
                    </li>
                  ) : null}
                  <li className="flex items-start gap-2">
                    <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span>{sex}</span>
                  </li>
                  {birthDate ? (
                    <li className="flex items-start gap-2">
                      <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span dir="ltr">{birthDate}</span>
                    </li>
                  ) : null}
                </ul>
              </CollapsibleCvSection>
            ) : null}

            <CollapsibleCvSection
              id="cv-skills"
              title="المهارات"
              open={openMap['cv-skills'] !== false}
              onOpenChange={(open) => setSectionOpen('cv-skills', open)}
            >
              <div className="flex flex-wrap gap-1.5">
                {skills.length ? (
                  skills.map((item) => (
                    <span key={item} className="chip">
                      {item}
                    </span>
                  ))
                ) : (
                  <EmptyHint>لا توجد مهارات بعد</EmptyHint>
                )}
              </div>
            </CollapsibleCvSection>

            <CollapsibleCvSection
              id="cv-languages"
              title="اللغات"
              icon={<Languages className="h-3.5 w-3.5 text-slate-400" />}
              open={openMap['cv-languages'] !== false}
              onOpenChange={(open) => setSectionOpen('cv-languages', open)}
            >
              <ul className="space-y-2">
                {languages.length ? (
                  languages.map((item) => (
                    <li key={item.language} className="border border-line bg-white px-2.5 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-800">{item.language}</span>
                        {item.proficiency != null ? (
                          <span className="text-[11px] font-semibold text-brand-ink" dir="ltr">
                            {item.proficiency}/10
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </div>
                      {item.proficiency != null ? (
                        <div className="mt-1.5 h-1 overflow-hidden bg-slate-100">
                          <div
                            className="h-full bg-brand"
                            style={{
                              width: `${Math.min(100, Math.max(0, item.proficiency * 10))}%`,
                            }}
                          />
                        </div>
                      ) : null}
                      {item.openToTranslate ? (
                        <p className="mt-1.5 text-[10px] font-medium text-muted">متاح للترجمة</p>
                      ) : null}
                    </li>
                  ))
                ) : (
                  <EmptyHint>لا توجد لغات بعد</EmptyHint>
                )}
              </ul>
            </CollapsibleCvSection>

            {!!interests.length && (
              <CollapsibleCvSection
                id="cv-interests"
                title="الاهتمامات"
                open={openMap['cv-interests'] !== false}
                onOpenChange={(open) => setSectionOpen('cv-interests', open)}
              >
                <div className="flex flex-wrap gap-1.5">
                  {interests.map((item) => (
                    <span key={item} className="chip">
                      {item}
                    </span>
                  ))}
                </div>
              </CollapsibleCvSection>
            )}
          </div>
        </aside>

        <div className="space-y-7 p-5 sm:p-7">
          <header className="hidden border-b border-line pb-5 lg:block">
            <p className="page-kicker">سيرة ذاتية · إبتكار</p>
            <h1 className="mt-1.5 text-3xl font-bold text-ink">{name}</h1>
            {role ? <p className="mt-1.5 text-base font-medium text-brand">{role}</p> : null}
            {educationBits ? (
              <p className="mt-1 text-sm text-muted">
                {[educationBits, vms?.school].filter(Boolean).join(' · ')}
              </p>
            ) : null}
          </header>

          {data.profile.summary ? (
            <CollapsibleCvSection
              id="cv-summary"
              title="نبذة مهنية"
              open={openMap['cv-summary'] !== false}
              onOpenChange={(open) => setSectionOpen('cv-summary', open)}
              onHover={() => hoverSection('cv-summary')}
            >
              <p className="whitespace-pre-wrap leading-7 text-slate-700">{data.profile.summary}</p>
            </CollapsibleCvSection>
          ) : null}

          {hasWorkPrefs ? (
            <CollapsibleCvSection
              id="cv-work-prefs"
              title="تفضيلات العمل"
              icon={<MapPinned className="h-3.5 w-3.5 text-slate-400" />}
              open={openMap['cv-work-prefs'] !== false}
              onOpenChange={(open) => setSectionOpen('cv-work-prefs', open)}
              onHover={() => hoverSection('cv-work-prefs')}
            >
              {!!workPreferences.jobTypes.length && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {workPreferences.jobTypes.map((id) => (
                    <span key={id} className="chip">
                      {jobTypeLabel(id as OpenJobType)}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-sm text-slate-700">
                الانتقال للعمل:{' '}
                <span className="font-semibold">
                  {workPreferences.canRelocate ? 'نعم' : 'لا'}
                </span>
              </p>
              {workPreferences.canRelocate && workPreferences.relocateNotes ? (
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                  {workPreferences.relocateNotes}
                </p>
              ) : null}
              {!!workPreferences.locations.length && (
                <ul className="mt-3 space-y-2">
                  {workPreferences.locations.map((loc) => {
                    const salary = formatSalaryRange(loc.salaryMin, loc.salaryMax, loc.currency)
                    return (
                      <li
                        key={`${loc.kind}-${loc.countryName || 'remote'}`}
                        className="border border-line px-3 py-2 text-sm"
                      >
                        <span className="font-semibold text-ink">{locationLabel(loc)}</span>
                        {salary ? (
                          <span className="mt-0.5 block text-xs text-muted" dir="ltr">
                            {salary} / month
                          </span>
                        ) : (
                          <span className="mt-0.5 block text-xs text-slate-400">راتب غير محدد</span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </CollapsibleCvSection>
          ) : null}

          <CollapsibleCvSection
            id="cv-experience"
            title="الخبرة العملية"
            icon={<Briefcase className="h-3.5 w-3.5 text-slate-400" />}
            open={openMap['cv-experience'] !== false}
            onOpenChange={(open) => setSectionOpen('cv-experience', open)}
              onHover={() => hoverSection('cv-experience')}
          >
            <ul className="divide-y divide-line">
              {data.workExperiences?.map((item) => (
                <li key={item.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className="font-semibold text-ink">{item.title}</p>
                      <p className="text-sm text-muted">
                        {[item.company_name, item.location].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <p className="text-xs font-medium text-slate-500" dir="ltr">
                      {formatDateRange(item.start_date, item.end_date, item.is_current)}
                    </p>
                  </div>
                  {(item.responsibilities || item.description) && (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                      {item.responsibilities || item.description}
                    </p>
                  )}
                  {item.achievements ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-500">
                      {item.achievements}
                    </p>
                  ) : null}
                  {!!item.skills?.length && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.skills.map((skill) => (
                        <span key={skill.skillId || skill.name} className="chip">
                          {skill.name}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
              {!data.workExperiences?.length && <EmptyHint>لا توجد خبرات مسجّلة بعد.</EmptyHint>}
            </ul>
          </CollapsibleCvSection>

          <CollapsibleCvSection
            id="cv-education"
            title="التعليم"
            icon={<GraduationCap className="h-3.5 w-3.5 text-slate-400" />}
            open={openMap['cv-education'] !== false}
            onOpenChange={(open) => setSectionOpen('cv-education', open)}
              onHover={() => hoverSection('cv-education')}
          >
            {educationBits || vms?.school ? (
              <div>
                <p className="font-semibold text-ink">
                  {vms?.fieldOfStudy || vms?.educationLevel || 'خلفية أكاديمية'}
                </p>
                <p className="mt-0.5 text-sm text-muted">
                  {[vms?.school, vms?.educationLevel].filter(Boolean).join(' · ')}
                </p>
                {vms?.graduationYear ? (
                  <p className="mt-1 text-xs text-slate-500">سنة التخرج: {vms.graduationYear}</p>
                ) : null}
              </div>
            ) : (
              <EmptyHint>لا توجد بيانات تعليم في منصة الأعضاء بعد.</EmptyHint>
            )}
          </CollapsibleCvSection>

          <CollapsibleCvSection
            id="cv-projects"
            title="المشاريع"
            icon={<FolderKanban className="h-3.5 w-3.5 text-slate-400" />}
            open={openMap['cv-projects'] !== false}
            onOpenChange={(open) => setSectionOpen('cv-projects', open)}
              onHover={() => hoverSection('cv-projects')}
          >
            <ul className="divide-y divide-line">
              {data.projects?.map((item) => (
                <li key={item.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className="font-semibold text-ink">{item.name}</p>
                      <p className="text-sm text-muted">
                        {[item.role, item.company].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {(item.start_date || item.end_date || item.is_ongoing) && (
                      <p className="text-xs text-slate-500" dir="ltr">
                        {formatDateRange(item.start_date, item.end_date, item.is_ongoing, 'مستمر')}
                      </p>
                    )}
                  </div>
                  {item.responsibilities ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                      {item.responsibilities}
                    </p>
                  ) : null}
                  {item.outcomes ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-500">
                      {item.outcomes}
                    </p>
                  ) : null}
                  {!!item.skills?.length && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.skills.map((skill) => (
                        <span key={skill.skillId || skill.name} className="chip">
                          {skill.name}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
              {!data.projects?.length && <EmptyHint>لا توجد مشاريع مسجّلة بعد.</EmptyHint>}
            </ul>
          </CollapsibleCvSection>

          {!!data.documents?.length && (
            <CollapsibleCvSection
              id="cv-documents"
              title="الملفات المرفقة"
              icon={<Download className="h-3.5 w-3.5 text-slate-400" />}
              open={openMap['cv-documents'] !== false}
              onOpenChange={(open) => setSectionOpen('cv-documents', open)}
              onHover={() => hoverSection('cv-documents')}
            >
              <ul className="divide-y divide-line border border-line">
                {data.documents.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <FileTypeIcon
                        fileName={doc.file_name}
                        contentType={doc.content_type}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink" title={doc.file_name}>
                          {doc.file_name}
                        </p>
                        <p className="text-xs text-slate-500">{documentKindLabel(doc.kind)}</p>
                      </div>
                    </div>
                    {canDownload ? (
                      <button
                        type="button"
                        className="btn-ghost shrink-0 py-1.5 text-xs"
                        onClick={() => onDownloadDocument?.(doc)}
                      >
                        تنزيل
                      </button>
                    ) : limited ? (
                      <span className="shrink-0 text-[11px] font-medium text-slate-400">
                        محمي
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </CollapsibleCvSection>
          )}
        </div>
      </div>
    </article>
      {!compact ? (
        <CvSectionMap items={mapItems} activeId={activeId} onNavigate={navigateToSection} onHover={hoverSection} />
      ) : null}
    </div>
  )
}
