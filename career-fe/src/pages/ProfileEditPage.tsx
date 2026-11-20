import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Briefcase,
  Eye,
  FileText,
  FolderKanban,
  GraduationCap,
  Heart,
  Languages,
  ListChecks,
  MapPinned,
  Pencil,
  Save,
  Trash2,
  User,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { AddProjectForm } from '../components/AddProjectForm'
import { AddWorkExperienceForm } from '../components/AddWorkExperienceForm'
import { ChangelogModal } from '../components/ChangelogModal'
import { CountrySelect, type LocationPick } from '../components/CountrySelect'
import { CvDocument } from '../components/CvDocument'
import { DraftRestoredModal } from '../components/DraftRestoredModal'
import { LocationLabel } from '../components/LocationLabel'
import { type SkillOption } from '../components/SkillPicker'
import { isSyriaName } from '../lib/countries'
import {
  clearCvEditDraft,
  draftsDiffer,
  draftSnapshot,
  readCvEditDraft,
  writeCvEditDraft,
} from '../lib/cv-edit-draft'
import {
  buildProfileChangelog,
  snapshotFromDraft,
  type ChangelogEntry,
  type ProfileDraftSnapshot,
} from '../lib/profile-changelog'
import {
  displayNameOf,
  formatBirthDate,
  formatLocation,
  sexLabel,
  splitCsv,
} from '../lib/profile-utils'
import { getVmsProfileUrl } from '../lib/vms-sso'
import {
  emptyWorkPreferences,
  JOB_TYPE_OPTIONS,
  normalizeWorkPreferences,
  sortWorkLocations,
  type OpenJobType,
  type WorkLocationPref,
  type WorkPreferences,
} from '../lib/work-preferences'
import { authDownloadHeaders, profilesApi } from '../services/api'

type EditSection =
  | 'profile'
  | 'education'
  | 'skills'
  | 'workPrefs'
  | 'experience'
  | 'projects'
  | 'documents'

const EDIT_SECTIONS: Array<{
  id: EditSection
  label: string
  icon: typeof User
}> = [
  { id: 'profile', label: 'الملف الشخصي', icon: User },
  { id: 'education', label: 'التعليم', icon: GraduationCap },
  { id: 'skills', label: 'المهارات واللغات', icon: Heart },
  { id: 'workPrefs', label: 'تفضيلات العمل', icon: MapPinned },
  { id: 'experience', label: 'الخبرة', icon: Briefcase },
  { id: 'projects', label: 'المشاريع', icon: FolderKanban },
  { id: 'documents', label: 'الملفات', icon: FileText },
]

type LanguagePref = {
  language: string
  proficiency: number | null
  openToTranslate: boolean
}

export default function ProfileEditPage() {
  const [data, setData] = useState<any>(null)
  const [summary, setSummary] = useState('')
  const [languagePrefs, setLanguagePrefs] = useState<LanguagePref[]>([])
  const [workPrefs, setWorkPrefs] = useState<WorkPreferences>(emptyWorkPreferences())
  const [baseline, setBaseline] = useState<ProfileDraftSnapshot | null>(null)
  const [changelogOpen, setChangelogOpen] = useState(false)
  const [changelogEntries, setChangelogEntries] = useState<ChangelogEntry[]>([])
  const [pendingAction, setPendingAction] = useState<'save' | 'publish' | 'review' | null>(null)
  const [saving, setSaving] = useState(false)
  const [editSection, setEditSection] = useState<EditSection>('profile')
  const [draftReady, setDraftReady] = useState(false)
  const [draftRestoredOpen, setDraftRestoredOpen] = useState(false)
  const [draftRestoredAt, setDraftRestoredAt] = useState<string | null>(null)
  const [livePreviewOpen, setLivePreviewOpen] = useState(false)

  const load = async (options?: { restoreLocalDraft?: boolean }) => {
    const restoreLocalDraft = Boolean(options?.restoreLocalDraft)
    setDraftReady(false)
    const payload = await profilesApi.me()
    setData(payload)
    const membershipNumber = String(payload.profile?.membership_number || '')
    const nextSummary = payload.profile?.summary || ''
    const fromApi: LanguagePref[] = Array.isArray(payload.languages)
      ? payload.languages.map((item: any) => ({
          language: String(item.language || '').trim(),
          proficiency:
            item.proficiency == null || item.proficiency === ''
              ? null
              : Number(item.proficiency),
          openToTranslate: Boolean(item.openToTranslate),
        }))
      : splitCsv(payload.vmsProfile?.languages).map((language) => ({
          language,
          proficiency: null,
          openToTranslate: false,
        }))
    const nextLanguages = fromApi.filter((item) => item.language)
    const nextWorkPrefs = normalizeWorkPreferences(payload.workPreferences)
    const serverSnapshot = snapshotFromDraft({
      summary: nextSummary,
      languages: nextLanguages,
      workPreferences: nextWorkPrefs,
    })

    if (restoreLocalDraft) {
      const localDraft = membershipNumber ? readCvEditDraft(membershipNumber) : null
      const localSnapshot = localDraft
        ? draftSnapshot({
            summary: localDraft.summary,
            languages: localDraft.languages,
            workPreferences: localDraft.workPreferences,
          })
        : null
      const shouldRestore =
        Boolean(localSnapshot) && draftsDiffer(serverSnapshot, localSnapshot!)

      if (shouldRestore && localDraft) {
        setSummary(localDraft.summary)
        setLanguagePrefs(localDraft.languages)
        setWorkPrefs(localDraft.workPreferences)
        setDraftRestoredAt(localDraft.savedAt || null)
        setDraftRestoredOpen(true)
      } else {
        setSummary(nextSummary)
        setLanguagePrefs(nextLanguages)
        setWorkPrefs(nextWorkPrefs)
        setDraftRestoredOpen(false)
        setDraftRestoredAt(null)
        if (membershipNumber && localDraft && !shouldRestore) {
          clearCvEditDraft(membershipNumber)
        }
      }
    }

    setBaseline(serverSnapshot)
    setChangelogOpen(false)
    setChangelogEntries([])
    setPendingAction(null)
    setDraftReady(true)
  }

  const currentDraft = () =>
    snapshotFromDraft({
      summary,
      languages: languagePrefs,
      workPreferences: workPrefs,
    })

  const openChangelog = (action: 'save' | 'publish' | 'review') => {
    if (!baseline) return
    const entries = buildProfileChangelog(baseline, currentDraft())
    if (!entries.length) {
      if (action === 'publish') {
        void commitChanges(action)
        return
      }
      toast(action === 'review' ? 'لا توجد تعديلات حالياً' : 'لا توجد تغييرات للحفظ')
      return
    }
    setChangelogEntries(entries)
    setPendingAction(action)
    setChangelogOpen(true)
  }

  const commitChanges = async (
    action: 'save' | 'publish' | 'review' = pendingAction || 'save',
  ) => {
    if (action === 'review') {
      setChangelogOpen(false)
      setPendingAction(null)
      return
    }
    setSaving(true)
    try {
      const publishNext =
        action === 'publish' ? !data?.profile?.is_published : undefined
      await profilesApi.updateMe({
        summary,
        ...(publishNext === undefined ? {} : { is_published: publishNext }),
      })
      await profilesApi.updateLanguages(languagePrefs)
      await profilesApi.updateWorkPreferences({
        canRelocate: workPrefs.canRelocate,
        relocateNotes: workPrefs.relocateNotes,
        jobTypes: workPrefs.jobTypes,
        locations: workPrefs.locations,
      })
      if (action === 'publish') {
        toast.success(
          publishNext ? 'تم نشر السيرة' : 'تم إلغاء النشر',
        )
      } else {
        toast.success('تم حفظ السيرة')
      }
      const membershipNumber = String(data?.profile?.membership_number || '')
      if (membershipNumber) clearCvEditDraft(membershipNumber)
      setChangelogOpen(false)
      setPendingAction(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    void load({ restoreLocalDraft: true }).catch(() => toast.error('تعذّر تحميل السيرة'))
  }, [])

  useEffect(() => {
    if (!draftReady || !baseline || !data?.profile?.membership_number) return
    const membershipNumber = String(data.profile.membership_number)
    const current = currentDraft()
    if (!draftsDiffer(baseline, current)) {
      clearCvEditDraft(membershipNumber)
      return
    }
    const timer = window.setTimeout(() => {
      writeCvEditDraft(membershipNumber, {
        summary,
        languages: languagePrefs,
        workPreferences: workPrefs,
      })
    }, 350)
    return () => window.clearTimeout(timer)
  }, [baseline, data, draftReady, languagePrefs, summary, workPrefs])

  const discardLocalDraft = () => {
    const membershipNumber = String(data?.profile?.membership_number || '')
    if (membershipNumber) clearCvEditDraft(membershipNumber)
    if (baseline) {
      setSummary(baseline.summary)
      setLanguagePrefs(baseline.languages)
      setWorkPrefs(baseline.workPreferences)
    }
    setDraftRestoredOpen(false)
    setDraftRestoredAt(null)
  }

  const skills = useMemo(() => splitCsv(data?.vmsProfile?.skills), [data])
  const interests = useMemo(() => splitCsv(data?.vmsProfile?.interests), [data])
  const availableSkills: SkillOption[] = useMemo(() => {
    const fromMember: SkillOption[] = (data?.memberSkills || []).map((s: any) => ({
      skillId: s.skillId,
      name: s.name,
    }))
    const fromCsv = skills
      .filter((name) => !fromMember.some((s) => s.name.toLowerCase() === name.toLowerCase()))
      .map((name) => ({ name }))
    return [...fromMember, ...fromCsv]
  }, [data, skills])

  const saveProfile = (event?: FormEvent) => {
    event?.preventDefault()
    openChangelog('save')
  }

  const reviewChanges = () => {
    openChangelog('review')
  }

  const togglePublish = () => {
    openChangelog('publish')
  }

  const updateLanguage = (language: string, patch: Partial<LanguagePref>) => {
    setLanguagePrefs((prev) =>
      prev.map((item) => (item.language === language ? { ...item, ...patch } : item)),
    )
  }

  const updateLocation = (index: number, patch: Partial<WorkLocationPref>) => {
    setWorkPrefs((prev) => ({
      ...prev,
      locations: prev.locations.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }))
  }

  const addWorkLocation = (pick: LocationPick) => {
    setWorkPrefs((prev) => {
      if (pick.kind === 'remote') {
        if (prev.locations.some((loc) => loc.kind === 'remote')) return prev
        return {
          ...prev,
          locations: sortWorkLocations([
            ...prev.locations,
            {
              kind: 'remote',
              countryName: null,
              salaryMin: null,
              salaryMax: null,
              currency: 'USD',
            },
          ]),
        }
      }

      const countryName = pick.countryName.trim()
      if (!countryName) return prev
      if (
        prev.locations.some(
          (loc) =>
            loc.kind === 'country' &&
            loc.countryName?.toLowerCase() === countryName.toLowerCase(),
        )
      ) {
        return prev
      }
      return {
        ...prev,
        locations: sortWorkLocations([
          ...prev.locations,
          {
            kind: 'country',
            countryName,
            salaryMin: null,
            salaryMax: null,
            currency: 'USD',
          },
        ]),
      }
    })
  }

  const removeLocation = (index: number) => {
    setWorkPrefs((prev) => ({
      ...prev,
      locations: prev.locations.filter((_, i) => i !== index),
    }))
  }

  const toggleJobType = (id: OpenJobType) => {
    setWorkPrefs((prev) => {
      const has = prev.jobTypes.includes(id)
      return {
        ...prev,
        jobTypes: has ? prev.jobTypes.filter((item) => item !== id) : [...prev.jobTypes, id],
      }
    })
  }

  const onUpload = async (file: File | null, kind: string) => {
    if (!file) return
    await profilesApi.uploadDocument(file, kind)
    toast.success('تم رفع الملف')
    await load()
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center py-16">
        <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />
        <p className="text-sm text-muted">جاري تحميل بيانات سيرتك…</p>
      </div>
    )
  }

  const vms = data.vmsProfile
  const displayName = displayNameOf(data)
  const livePreviewData = {
    ...data,
    profile: { ...data.profile, summary },
    languages: languagePrefs,
    workPreferences: workPrefs,
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            to="/profile"
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-brand"
          >
            <ArrowRight className="h-4 w-4" />
            العودة للسيرة المحفوظة
          </Link>
          <p className="page-kicker">تعديل السيرة</p>
          <h1 className="page-title">{displayName}</h1>
          <p className="page-desc">
            عدّل كل قسم من التبويبات أدناه، ثم احفظ عند الانتهاء.
          </p>
        </div>
        <span className={`status-pill ${data.profile.is_published ? 'is-live' : 'is-draft'}`}>
          {data.profile.is_published ? 'منشورة' : 'مسودة'}
        </span>
      </div>

      <div className={`space-y-4 ${livePreviewOpen ? 'hidden' : ''}`}>
          <nav className="panel overflow-x-auto p-1.5" aria-label="أقسام التعديل">
            <div className="flex min-w-max gap-1">
              {EDIT_SECTIONS.map((section) => {
                const Icon = section.icon
                const active = editSection === section.id
                return (
                  <button
                    key={section.id}
                    type="button"
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold transition ${
                      active
                        ? 'bg-brand text-white'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-ink'
                    }`}
                    onClick={() => setEditSection(section.id)}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {section.label}
                  </button>
                )
              })}
            </div>
          </nav>

          {editSection === 'profile' ? (
          <section className="panel p-4 sm:p-6">
            <h2 className="section-title">
              <User className="h-4 w-4 text-slate-400" />
              معلومات الملف الشخصي
            </h2>

            <div className="mb-6 flex flex-wrap items-center gap-4">
              {vms?.profilePictureUrl ? (
                <img
                  src={vms.profilePictureUrl}
                  alt=""
                  className="h-24 w-24 rounded-md border border-line object-cover sm:h-28 sm:w-28"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-400 sm:h-28 sm:w-28">
                  بلا صورة
                </div>
              )}
              <div className="space-y-2 text-sm text-slate-600">
                <p>الصورة والبيانات الشخصية تُدار في منصة الأعضاء.</p>
                <a className="btn-ghost py-2 text-xs" href={getVmsProfileUrl()} target="_blank" rel="noreferrer">
                  تعديل الملف / الصورة في منصة الأعضاء
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="label">الاسم الكامل</label>
                <input className="field-readonly" readOnly value={displayName} />
              </div>
              <div>
                <label className="label">البريد الإلكتروني</label>
                <input className="field-readonly" readOnly value={vms?.email || '—'} />
              </div>
              <div>
                <label className="label">رقم الهاتف</label>
                <input className="field-readonly" readOnly value={vms?.phoneNumber || '—'} dir="ltr" />
              </div>
              <div>
                <label className="label">الدولة / المحافظة / المدينة</label>
                <input
                  className="field-readonly"
                  readOnly
                  value={formatLocation({
                    country: vms?.country,
                    region: vms?.region,
                    city: vms?.city,
                  }) || '—'}
                />
              </div>
              <div>
                <label className="label">الجنس</label>
                <input className="field-readonly" readOnly value={sexLabel(vms?.sex)} />
              </div>
              <div>
                <label className="label">تاريخ الميلاد</label>
                <input
                  className="field-readonly"
                  readOnly
                  value={formatBirthDate(vms?.dateOfBirth) || '—'}
                  dir="ltr"
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">نبذة مهنية</label>
                <textarea
                  className="field min-h-28"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="اكتب نبذة مختصرة عن خبرتك وأهدافك المهنية"
                />
              </div>
            </div>
          </section>
          ) : null}

          {editSection === 'education' ? (
          <section className="panel p-4 sm:p-6">
            <h2 className="section-title">
              <GraduationCap className="h-4 w-4 text-slate-400" />
              الخلفية الأكاديمية
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="label">المستوى التعليمي</label>
                <input className="field-readonly" readOnly value={vms?.educationLevel || '—'} />
              </div>
              <div>
                <label className="label">مجال الدراسة</label>
                <input className="field-readonly" readOnly value={vms?.fieldOfStudy || '—'} />
              </div>
              <div>
                <label className="label">المؤسسة</label>
                <input className="field-readonly" readOnly value={vms?.school || '—'} />
              </div>
              <div>
                <label className="label">سنة التخرج</label>
                <input
                  className="field-readonly"
                  readOnly
                  value={vms?.graduationYear ? String(vms.graduationYear) : '—'}
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">لتعديل التعليم، حدّث ملفك في منصة الأعضاء.</p>
          </section>
          ) : null}

          {editSection === 'skills' ? (
          <section className="panel p-4 sm:p-6">
            <h2 className="section-title">
              <Heart className="h-4 w-4 text-slate-400" />
              المهارات والاهتمامات واللغات
            </h2>
            <div className="space-y-5">
              <div>
                <p className="label">المهارات</p>
                <div className="flex flex-wrap gap-2">
                  {skills.length ? (
                    skills.map((item) => (
                      <span key={item} className="chip">
                        {item}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-400">لا توجد مهارات مضافة في منصة الأعضاء بعد.</span>
                  )}
                </div>
              </div>
              <div>
                <p className="label">الاهتمامات</p>
                <div className="flex flex-wrap gap-2">
                  {interests.length ? (
                    interests.map((item) => (
                      <span key={item} className="chip">
                        {item}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-400">لا توجد اهتمامات مضافة بعد.</span>
                  )}
                </div>
              </div>
              <div>
                <p className="label flex items-center gap-2">
                  <Languages className="h-4 w-4 text-brand" />
                  اللغات
                </p>
                <p className="mb-3 text-xs text-slate-500">
                  أسماء اللغات من منصة الأعضاء. حدّد مستوى الإتقان (1–10) وهل ترغب بالعمل مترجماً لكل لغة.
                </p>
                {languagePrefs.length ? (
                  <ul className="space-y-3">
                    {languagePrefs.map((item) => (
                      <li
                        key={item.language}
                        className="border border-line bg-slate-50/80 p-3 sm:p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-bold text-slate-900">{item.language}</p>
                          <span className="text-xs font-semibold text-brand" dir="ltr">
                            {item.proficiency != null ? `${item.proficiency}/10` : 'غير محدد'}
                          </span>
                        </div>
                        <div className="mt-3">
                          <label className="mb-1.5 block text-xs font-medium text-slate-600">
                            مستوى الإتقان (1–10)
                          </label>
                          <select
                            className="field max-w-[12rem]"
                            value={item.proficiency ?? ''}
                            onChange={(e) =>
                              updateLanguage(item.language, {
                                proficiency: e.target.value === '' ? null : Number(e.target.value),
                              })
                            }
                          >
                            <option value="">غير محدد</option>
                            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </div>
                        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={item.openToTranslate}
                            onChange={(e) =>
                              updateLanguage(item.language, {
                                openToTranslate: e.target.checked,
                              })
                            }
                          />
                          أرغب بالعمل مترجماً بهذه اللغة
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-sm text-slate-400">
                    لا توجد لغات مضافة بعد. أضفها من منصة الأعضاء ثم أعد تحميل الصفحة.
                  </span>
                )}
              </div>
            </div>
          </section>
          ) : null}

          {editSection === 'workPrefs' ? (
          <section className="panel p-4 sm:p-6">
            <h2 className="section-title">
              <MapPinned className="h-4 w-4 text-slate-400" />
              تفضيلات العمل والراتب
            </h2>

            <div className="mb-4">
              <p className="label">أنواع العمل المتاحة حالياً</p>
              <p className="mb-2 text-xs text-slate-500">يمكن اختيار أكثر من نوع.</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {JOB_TYPE_OPTIONS.map((opt) => (
                  <label
                    key={opt.id}
                    className="inline-flex cursor-pointer items-center gap-2 border border-line bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={workPrefs.jobTypes.includes(opt.id)}
                      onChange={() => toggleJobType(opt.id)}
                    />
                    <span>
                      <span className="font-semibold text-slate-900">{opt.labelAr}</span>
                      <span className="ms-1 text-xs text-slate-400">({opt.labelEn})</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-start gap-3 border border-line bg-slate-50/80 p-3 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-1"
                checked={workPrefs.canRelocate}
                onChange={(e) =>
                  setWorkPrefs((prev) => ({ ...prev, canRelocate: e.target.checked }))
                }
              />
              <span>
                <span className="block font-semibold text-slate-900">يمكنني الانتقال للعمل</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  فعّل إذا كنت مستعداً للانتقال الجغرافي لوظيفة بدوام كامل
                </span>
              </span>
            </label>

            {workPrefs.canRelocate ? (
              <div className="mt-3">
                <label className="label">تفاصيل الانتقال (اختياري)</label>
                <textarea
                  className="field min-h-20"
                  value={workPrefs.relocateNotes}
                  onChange={(e) =>
                    setWorkPrefs((prev) => ({ ...prev, relocateNotes: e.target.value }))
                  }
                  placeholder="مثال: مستعد للانتقال داخل تركيا أو إلى سوريا أو إلى دول الخليج خلال 3 أشهر"
                />
              </div>
            ) : null}

            <div className="mt-5">
              <p className="label">أماكن العمل المتوقعة والراتب الشهري (دوام كامل)</p>
              <p className="mb-3 text-xs text-slate-500">
                اختر عن بُعد أو دولاً من القائمة. الترتيب: عن بُعد، سوريا، تركيا، ثم الباقي أبجدياً.
              </p>
              <ul className="space-y-3">
                {workPrefs.locations.map((loc, index) => (
                  <li key={`${loc.kind}-${loc.countryName || 'remote'}`} className="border border-line p-3 sm:p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="font-bold text-slate-900">
                        <LocationLabel location={loc} />
                      </p>
                      <button
                        type="button"
                        className="btn-danger py-1.5 text-xs"
                        onClick={() => removeLocation(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        حذف
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <label className="label">الحد الأدنى شهرياً</label>
                        <input
                          className="field"
                          type="number"
                          min={0}
                          dir="ltr"
                          value={loc.salaryMin ?? ''}
                          onChange={(e) =>
                            updateLocation(index, {
                              salaryMin: e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                          placeholder={
                            loc.kind === 'country' && isSyriaName(loc.countryName)
                              ? 'مثال: 500'
                              : 'مثال: 800'
                          }
                        />
                      </div>
                      <div>
                        <label className="label">الحد الأعلى شهرياً</label>
                        <input
                          className="field"
                          type="number"
                          min={0}
                          dir="ltr"
                          value={loc.salaryMax ?? ''}
                          onChange={(e) =>
                            updateLocation(index, {
                              salaryMax: e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                          placeholder={
                            loc.kind === 'country' && isSyriaName(loc.countryName)
                              ? 'مثال: 1000'
                              : 'مثال: 1500'
                          }
                        />
                      </div>
                      <div>
                        <label className="label">العملة</label>
                        <input
                          className="field"
                          dir="ltr"
                          value={loc.currency}
                          onChange={(e) =>
                            updateLocation(index, {
                              currency: e.target.value.toUpperCase().slice(0, 8),
                            })
                          }
                          placeholder="USD"
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-3 max-w-md">
                <CountrySelect
                  excludeRemote={workPrefs.locations.some((loc) => loc.kind === 'remote')}
                  excludeNames={workPrefs.locations
                    .filter((loc) => loc.kind === 'country')
                    .map((loc) => loc.countryName || '')}
                  onPick={addWorkLocation}
                  placeholder="ابحث واختر عن بُعد أو دولة"
                />
              </div>
            </div>
          </section>
          ) : null}

          {editSection === 'experience' ? (
          <section className="panel p-4 sm:p-6">
            <h2 className="section-title">
              <Briefcase className="h-4 w-4 text-slate-400" />
              الخبرة العملية
            </h2>
            <ul className="space-y-3">
              {data.workExperiences?.map((item: any, index: number) => (
                <li key={item.id} className="border border-line p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-brand">الخبرة #{index + 1}</p>
                      <p className="mt-1 font-bold text-slate-900">
                        {item.title} · {item.company_name}
                      </p>
                      <p className="text-sm text-slate-500">
                        {item.start_date || '؟'} — {item.is_current ? 'حالياً' : item.end_date || '؟'}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                        {item.responsibilities || item.description}
                      </p>
                      {item.achievements ? (
                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-500">{item.achievements}</p>
                      ) : null}
                      {!!item.skills?.length && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.skills.map((skill: any) => (
                            <span key={skill.skillId || skill.name} className="chip">
                              {skill.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn-danger py-1.5 text-xs"
                      onClick={() =>
                        void profilesApi.deleteWork(item.id).then(load).then(() => toast.success('تم الحذف'))
                      }
                    >
                      حذف
                    </button>
                  </div>
                </li>
              ))}
              {!data.workExperiences?.length && (
                <p className="text-sm text-slate-400">لا توجد خبرات عملية بعد.</p>
              )}
            </ul>

            <AddWorkExperienceForm availableSkills={availableSkills} onAdded={load} />
          </section>
          ) : null}

          {editSection === 'projects' ? (
          <section className="panel p-4 sm:p-6">
            <h2 className="section-title">
              <FolderKanban className="h-4 w-4 text-slate-400" />
              المشاريع
            </h2>
            <ul className="space-y-3">
              {data.projects?.map((item: any, index: number) => (
                <li key={item.id} className="border border-line p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-brand">المشروع {index + 1}</p>
                      <p className="mt-1 font-bold text-slate-900">{item.name}</p>
                      <p className="text-sm text-slate-500">
                        {[item.role, item.company].filter(Boolean).join(' · ')}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{item.responsibilities}</p>
                      {!!item.skills?.length && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.skills.map((skill: any) => (
                            <span key={skill.skillId || skill.name} className="chip">
                              {skill.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn-danger py-1.5 text-xs"
                      onClick={() =>
                        void profilesApi
                          .deleteProject(item.id)
                          .then(load)
                          .then(() => toast.success('تم الحذف'))
                      }
                    >
                      حذف
                    </button>
                  </div>
                </li>
              ))}
              {!data.projects?.length && <p className="text-sm text-slate-400">لا توجد مشاريع بعد.</p>}
            </ul>

            <AddProjectForm availableSkills={availableSkills} onAdded={load} />
          </section>
          ) : null}

          {editSection === 'documents' ? (
          <section className="panel p-4 sm:p-6">
            <h2 className="section-title">
              <FileText className="h-4 w-4 text-slate-400" />
              السيرة والملفات
            </h2>
            <div className="flex flex-wrap gap-3">
              <label className="btn-ghost cursor-pointer">
                رفع سيرة ذاتية (PDF)
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,image/*"
                  onChange={(e) => void onUpload(e.target.files?.[0] || null, 'cv')}
                />
              </label>
              <label className="btn-ghost cursor-pointer">
                رفع ملف أعمال
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,image/*"
                  onChange={(e) => void onUpload(e.target.files?.[0] || null, 'portfolio')}
                />
              </label>
            </div>
            <ul className="mt-4 space-y-2">
              {data.documents?.map((doc: any) => (
                <li
                  key={doc.id}
                  className="flex items-center justify-between border border-line px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{doc.file_name}</p>
                    <p className="text-xs text-slate-500">
                      {doc.kind === 'cv' ? 'سيرة ذاتية' : 'ملف أعمال'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-ghost py-1.5 text-xs"
                      onClick={() =>
                        void fetch(profilesApi.documentDownloadUrl(doc.id), {
                          headers: authDownloadHeaders(),
                        }).then(async (res) => {
                          const blob = await res.blob()
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = doc.file_name
                          a.click()
                          URL.revokeObjectURL(url)
                        })
                      }
                    >
                      تنزيل
                    </button>
                    <button
                      type="button"
                      className="btn-danger py-1.5 text-xs"
                      onClick={() =>
                        void profilesApi
                          .deleteDocument(doc.id)
                          .then(load)
                          .then(() => toast.success('تم الحذف'))
                      }
                    >
                      حذف
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
          ) : null}
      </div>

      {!livePreviewOpen ? (
        <div className="sticky bottom-3 z-10 flex flex-wrap gap-3 border border-line bg-white/95 p-3 backdrop-blur-sm">
          <button
            type="button"
            className="btn-primary"
            disabled={saving}
            onClick={() => saveProfile()}
          >
            <Save className="h-4 w-4" />
            {saving ? 'جاري الحفظ…' : 'حفظ السيرة'}
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={saving}
            onClick={() => reviewChanges()}
          >
            <ListChecks className="h-4 w-4" />
            عرض التعديلات
          </button>
          <button type="button" className="btn-ghost" disabled={saving} onClick={() => togglePublish()}>
            {data.profile.is_published ? 'إلغاء النشر' : 'نشر السيرة للمراجعة'}
          </button>
          <button
            type="button"
            className="btn-ghost ms-auto"
            onClick={() => setLivePreviewOpen(true)}
          >
            <Eye className="h-4 w-4" />
            معاينة السيرة
          </button>
        </div>
      ) : null}

      {livePreviewOpen ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-brand-light/40 px-4 py-3">
            <div>
              <p className="text-sm font-bold text-brand-ink">معاينة حية للتعديلات الحالية</p>
              <p className="mt-0.5 text-xs text-muted">
                هذه معاينة داخل صفحة التعديل فقط — لم تُحفظ على الخادم بعد ما لم تضغط حفظ.
              </p>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setLivePreviewOpen(false)}
            >
              <Pencil className="h-4 w-4" />
              العودة للتعديل
            </button>
          </div>

          <CvDocument
            data={livePreviewData}
            onDownloadDocument={(doc) =>
              void fetch(profilesApi.documentDownloadUrl(doc.id), {
                headers: authDownloadHeaders(),
              }).then(async (res) => {
                const blob = await res.blob()
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = doc.file_name
                a.click()
                URL.revokeObjectURL(url)
              })
            }
          />

          <div className="sticky bottom-3 z-10 flex justify-end border border-line bg-white/95 p-3 backdrop-blur-sm">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setLivePreviewOpen(false)}
            >
              <X className="h-4 w-4" />
              إغلاق المعاينة
            </button>
          </div>
        </div>
      ) : null}

      <DraftRestoredModal
        open={draftRestoredOpen}
        savedAt={draftRestoredAt}
        onKeep={() => setDraftRestoredOpen(false)}
        onDiscard={discardLocalDraft}
      />

      <ChangelogModal
        open={changelogOpen}
        entries={changelogEntries}
        saving={saving}
        reviewOnly={pendingAction === 'review'}
        confirmLabel={
          pendingAction === 'review'
            ? 'إغلاق'
            : pendingAction === 'publish'
              ? data.profile.is_published
                ? 'تأكيد إلغاء النشر'
                : 'تأكيد النشر والحفظ'
              : 'تأكيد الحفظ'
        }
        onCancel={() => {
          if (saving) return
          setChangelogOpen(false)
          setPendingAction(null)
        }}
        onConfirm={() => void commitChanges()}
      />
    </div>
  )
}
