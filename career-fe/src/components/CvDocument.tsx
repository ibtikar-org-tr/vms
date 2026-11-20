import { type ReactNode } from 'react'
import {
  Briefcase,
  Calendar,
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
}

function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="text-sm text-slate-400">{children}</p>
}

export function CvDocument({ data, onDownloadDocument, compact }: Props) {
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
    .map((part) => part[0])
    .join('')

  return (
    <article
      className={`overflow-hidden rounded-lg border border-line bg-white ${
        compact ? '' : 'print:shadow-none'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <img src="/career-mark.svg" alt="" className="h-8 w-8 rounded-md object-cover ring-1 ring-line" />
          <div>
            <p className="text-sm font-bold text-ink">المسار المهني</p>
            <p className="text-[11px] text-muted">تصدير PDF · Markdown · TXT</p>
          </div>
        </div>
        <CvExportMenu data={data} />
      </div>

      <div className={`grid gap-0 lg:grid-cols-[230px_1fr] ${compact ? '' : 'lg:min-h-[640px]'}`}>
        <aside className="border-b border-line bg-[#f7f8fa] p-5 sm:p-6 lg:border-b-0 lg:border-l lg:border-line">
          <div className="flex flex-col items-center text-center lg:items-stretch lg:text-start">
            {vms?.profilePictureUrl ? (
              <img
                src={vms.profilePictureUrl}
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
            {(vms?.email || vms?.phoneNumber || location || birthDate || (sex && sex !== '—')) && (
              <div>
                <p className="cv-section-title">تواصل ومعلومات شخصية</p>
                <ul className="space-y-2.5 text-slate-600">
                  {vms?.email ? (
                    <li className="flex items-start gap-2 break-all">
                      <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span dir="ltr">{vms.email}</span>
                    </li>
                  ) : null}
                  {vms?.phoneNumber ? (
                    <li className="flex items-start gap-2">
                      <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span dir="ltr">{vms.phoneNumber}</span>
                    </li>
                  ) : null}
                  {location ? (
                    <li className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span>{location}</span>
                    </li>
                  ) : null}
                  {sex && sex !== '—' ? (
                    <li className="flex items-start gap-2">
                      <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span>{sex}</span>
                    </li>
                  ) : null}
                  {birthDate ? (
                    <li className="flex items-start gap-2">
                      <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span dir="ltr">{birthDate}</span>
                    </li>
                  ) : null}
                </ul>
              </div>
            )}

            <div>
              <p className="cv-section-title">المهارات</p>
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
            </div>

            <div>
              <p className="cv-section-title">
                <Languages className="h-3.5 w-3.5 text-slate-400" />
                اللغات
              </p>
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
                            style={{ width: `${Math.min(100, Math.max(0, item.proficiency * 10))}%` }}
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
            </div>

            {!!interests.length && (
              <div>
                <p className="cv-section-title">الاهتمامات</p>
                <div className="flex flex-wrap gap-1.5">
                  {interests.map((item) => (
                    <span key={item} className="chip">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
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
            <section>
              <h2 className="cv-section-title">نبذة مهنية</h2>
              <p className="whitespace-pre-wrap leading-7 text-slate-700">{data.profile.summary}</p>
            </section>
          ) : null}

          {(workPreferences.canRelocate ||
            workPreferences.jobTypes.length > 0 ||
            workPreferences.locations.length > 0) && (
            <section>
              <h2 className="cv-section-title">
                <MapPinned className="h-3.5 w-3.5 text-slate-400" />
                تفضيلات العمل
              </h2>
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
            </section>
          )}

          <section>
            <h2 className="cv-section-title">
              <Briefcase className="h-3.5 w-3.5 text-slate-400" />
              الخبرة العملية
            </h2>
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
          </section>

          <section>
            <h2 className="cv-section-title">
              <GraduationCap className="h-3.5 w-3.5 text-slate-400" />
              التعليم
            </h2>
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
          </section>

          <section>
            <h2 className="cv-section-title">
              <FolderKanban className="h-3.5 w-3.5 text-slate-400" />
              المشاريع
            </h2>
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
          </section>

          {!!data.documents?.length && (
            <section>
            <h2 className="cv-section-title">
              <Download className="h-3.5 w-3.5 text-slate-400" />
              الملفات المرفقة
            </h2>
              <ul className="divide-y divide-line border border-line">
                {data.documents.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold text-ink">{doc.file_name}</p>
                      <p className="text-xs text-slate-500">
                        {doc.kind === 'cv' ? 'سيرة ذاتية' : 'ملف أعمال'}
                      </p>
                    </div>
                    {onDownloadDocument ? (
                      <button
                        type="button"
                        className="btn-ghost py-1.5 text-xs"
                        onClick={() => onDownloadDocument(doc)}
                      >
                        تنزيل
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </article>
  )
}
