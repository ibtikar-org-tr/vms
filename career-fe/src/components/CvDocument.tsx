import type { ReactNode } from 'react'
import {
  Briefcase,
  Download,
  FolderKanban,
  GraduationCap,
  Languages,
  Mail,
  MapPin,
  Phone,
  Sparkles,
} from 'lucide-react'
import {
  displayNameOf,
  formatDateRange,
  latestRoleOf,
  splitCsv,
} from '../lib/profile-utils'

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
    city?: string | null
    country?: string | null
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
  const location = [vms?.city, vms?.country].filter(Boolean).join('، ')
  const educationBits = [vms?.educationLevel, vms?.fieldOfStudy].filter(Boolean).join(' · ')
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')

  return (
    <article
      className={`overflow-hidden rounded-2xl border border-line bg-white shadow-sheet ${
        compact ? '' : 'print:shadow-none'
      }`}
    >
      <div className="h-1.5 bg-gradient-to-l from-brand via-teal-500 to-accent" />

      <div className={`grid gap-0 lg:grid-cols-[240px_1fr] ${compact ? '' : 'lg:min-h-[640px]'}`}>
        {/* Sidebar */}
        <aside className="border-b border-line bg-slate-50/80 p-6 lg:border-b-0 lg:border-l lg:border-line">
          <div className="flex flex-col items-center text-center lg:items-stretch lg:text-start">
            {vms?.profilePictureUrl ? (
              <img
                src={vms.profilePictureUrl}
                alt=""
                className="mx-auto h-28 w-28 rounded-2xl object-cover ring-4 ring-white shadow-md lg:mx-0"
              />
            ) : (
              <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-teal-600 text-3xl font-bold text-white shadow-md lg:mx-0">
                {initials || '؟'}
              </div>
            )}

            <div className="mt-4 lg:hidden">
              <h1 className="text-2xl font-extrabold text-slate-900">{name}</h1>
              {role ? <p className="mt-1 font-semibold text-brand">{role}</p> : null}
            </div>
          </div>

          <div className="mt-6 space-y-4 text-sm">
            {(vms?.email || vms?.phoneNumber || location) && (
              <div>
                <p className="cv-section-title">تواصل</p>
                <ul className="space-y-2.5 text-slate-600">
                  {vms?.email ? (
                    <li className="flex items-start gap-2 break-all">
                      <Mail className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                      <span dir="ltr">{vms.email}</span>
                    </li>
                  ) : null}
                  {vms?.phoneNumber ? (
                    <li className="flex items-start gap-2">
                      <Phone className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                      <span dir="ltr">{vms.phoneNumber}</span>
                    </li>
                  ) : null}
                  {location ? (
                    <li className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                      <span>{location}</span>
                    </li>
                  ) : null}
                </ul>
              </div>
            )}

            <div>
              <p className="cv-section-title">
                <Sparkles className="h-3.5 w-3.5" />
                المهارات
              </p>
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
                <Languages className="h-3.5 w-3.5" />
                اللغات
              </p>
              <ul className="space-y-2">
                {languages.length ? (
                  languages.map((item) => (
                    <li key={item.language} className="rounded-lg border border-line bg-white px-2.5 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-800">{item.language}</span>
                        {item.proficiency != null ? (
                          <span className="text-[11px] font-bold text-brand" dir="ltr">
                            {item.proficiency}/10
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </div>
                      {item.proficiency != null ? (
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-brand"
                            style={{ width: `${Math.min(100, Math.max(0, item.proficiency * 10))}%` }}
                          />
                        </div>
                      ) : null}
                      {item.openToTranslate ? (
                        <p className="mt-1.5 text-[10px] font-medium text-teal-700">متاح للترجمة</p>
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
                    <span
                      key={item}
                      className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Main column */}
        <div className="space-y-8 p-6 sm:p-8">
          <header className="hidden border-b border-line pb-6 lg:block">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
              سيرة ذاتية · إبتكار
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              {name}
            </h1>
            {role ? <p className="mt-2 text-lg font-semibold text-brand">{role}</p> : null}
            {educationBits ? (
              <p className="mt-1 text-sm text-slate-500">
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

          <section>
            <h2 className="cv-section-title">
              <Briefcase className="h-3.5 w-3.5" />
              الخبرة العملية
            </h2>
            <ul className="space-y-5">
              {data.workExperiences?.map((item) => (
                <li key={item.id} className="relative pe-4 ps-4">
                  <span className="absolute end-0 top-2 h-2 w-2 rounded-full bg-brand" />
                  <span className="absolute end-[3px] top-4 bottom-0 w-px bg-line last:hidden" />
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-900">{item.title}</p>
                      <p className="text-sm font-medium text-brand">
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
              <GraduationCap className="h-3.5 w-3.5" />
              التعليم
            </h2>
            {educationBits || vms?.school ? (
              <div className="rounded-xl border border-line bg-slate-50/70 px-4 py-3">
                <p className="font-bold text-slate-900">
                  {vms?.fieldOfStudy || vms?.educationLevel || 'خلفية أكاديمية'}
                </p>
                <p className="mt-0.5 text-sm text-brand">
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
              <FolderKanban className="h-3.5 w-3.5" />
              المشاريع
            </h2>
            <ul className="space-y-4">
              {data.projects?.map((item) => (
                <li key={item.id} className="rounded-xl border border-line px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-900">{item.name}</p>
                      <p className="text-sm text-brand">
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
                <Download className="h-3.5 w-3.5" />
                الملفات المرفقة
              </h2>
              <ul className="space-y-2">
                {data.documents.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{doc.file_name}</p>
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
