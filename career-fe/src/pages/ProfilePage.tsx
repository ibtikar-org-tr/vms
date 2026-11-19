import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  Briefcase,
  Eye,
  FolderKanban,
  GraduationCap,
  Heart,
  Languages,
  MapPinned,
  Pencil,
  Save,
  Trash2,
  User,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { ChangelogModal } from '../components/ChangelogModal'
import { CountrySelect } from '../components/CountrySelect'
import { CvDocument } from '../components/CvDocument'
import { SkillPicker, type SkillOption } from '../components/SkillPicker'
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
  type OpenJobType,
  type WorkLocationPref,
  type WorkPreferences,
} from '../lib/work-preferences'
import { authDownloadHeaders, profilesApi } from '../services/api'

type Tab = 'preview' | 'edit'

type LanguagePref = {
  language: string
  proficiency: number | null
  openToTranslate: boolean
}

export default function ProfilePage() {
  const [data, setData] = useState<any>(null)
  const [summary, setSummary] = useState('')
  const [languagePrefs, setLanguagePrefs] = useState<LanguagePref[]>([])
  const [workPrefs, setWorkPrefs] = useState<WorkPreferences>(emptyWorkPreferences())
  const [baseline, setBaseline] = useState<ProfileDraftSnapshot | null>(null)
  const [changelogOpen, setChangelogOpen] = useState(false)
  const [changelogEntries, setChangelogEntries] = useState<ChangelogEntry[]>([])
  const [pendingAction, setPendingAction] = useState<'save' | 'publish' | null>(null)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<Tab>('preview')
  const [workForm, setWorkForm] = useState({
    company_name: '',
    title: '',
    location: '',
    start_date: '',
    end_date: '',
    is_current: false,
    responsibilities: '',
    achievements: '',
  })
  const [workSkills, setWorkSkills] = useState<SkillOption[]>([])
  const [projectForm, setProjectForm] = useState({
    name: '',
    role: '',
    company: '',
    project_type: 'personal',
    start_date: '',
    end_date: '',
    is_ongoing: false,
    responsibilities: '',
    outcomes: '',
  })
  const [projectSkills, setProjectSkills] = useState<SkillOption[]>([])

  const load = async () => {
    const payload = await profilesApi.me()
    setData(payload)
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
    setSummary(nextSummary)
    setLanguagePrefs(nextLanguages)
    setWorkPrefs(nextWorkPrefs)
    setBaseline(
      snapshotFromDraft({
        summary: nextSummary,
        languages: nextLanguages,
        workPreferences: nextWorkPrefs,
      }),
    )
    setChangelogOpen(false)
    setChangelogEntries([])
    setPendingAction(null)
  }

  const currentDraft = () =>
    snapshotFromDraft({
      summary,
      languages: languagePrefs,
      workPreferences: workPrefs,
    })

  const openChangelog = (action: 'save' | 'publish') => {
    if (!baseline) return
    const entries = buildProfileChangelog(baseline, currentDraft())
    if (!entries.length) {
      if (action === 'publish') {
        void commitChanges(action)
        return
      }
      toast('لا توجد تغييرات للحفظ')
      return
    }
    setChangelogEntries(entries)
    setPendingAction(action)
    setChangelogOpen(true)
  }

  const commitChanges = async (action: 'save' | 'publish' = pendingAction || 'save') => {
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
      setChangelogOpen(false)
      setPendingAction(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    void load().catch(() => toast.error('تعذّر تحميل السيرة'))
  }, [])

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

  const addCountryLocation = (name: string) => {
    const countryName = name.trim()
    if (!countryName) return
    setWorkPrefs((prev) => {
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
        locations: [
          ...prev.locations,
          {
            kind: 'country',
            countryName,
            salaryMin: null,
            salaryMax: null,
            currency: 'USD',
          },
        ],
      }
    })
  }

  const removeLocation = (index: number) => {
    setWorkPrefs((prev) => {
      const target = prev.locations[index]
      if (!target || target.kind === 'remote') return prev
      return { ...prev, locations: prev.locations.filter((_, i) => i !== index) }
    })
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

  const addWork = async (event: FormEvent) => {
    event.preventDefault()
    await profilesApi.addWork({
      ...workForm,
      description: workForm.responsibilities,
      skills: workSkills,
    })
    setWorkForm({
      company_name: '',
      title: '',
      location: '',
      start_date: '',
      end_date: '',
      is_current: false,
      responsibilities: '',
      achievements: '',
    })
    setWorkSkills([])
    toast.success('تمت إضافة الخبرة')
    await load()
  }

  const addProject = async (event: FormEvent) => {
    event.preventDefault()
    await profilesApi.addProject({
      ...projectForm,
      skills: projectSkills,
    })
    setProjectForm({
      name: '',
      role: '',
      company: '',
      project_type: 'personal',
      start_date: '',
      end_date: '',
      is_ongoing: false,
      responsibilities: '',
      outcomes: '',
    })
    setProjectSkills([])
    toast.success('تمت إضافة المشروع')
    await load()
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
        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-brand" />
        <p className="text-slate-600">جاري تحميل بيانات سيرتك…</p>
      </div>
    )
  }

  const vms = data.vmsProfile
  const displayName = displayNameOf(data)
  const previewData = {
    ...data,
    profile: { ...data.profile, summary },
    languages: languagePrefs,
    workPreferences: workPrefs,
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand">سيرتي</p>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900 sm:text-3xl">
            {displayName}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            البيانات الشخصية من منصة الأعضاء · الخبرات والمشاريع تُحرَّر هنا
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              data.profile.is_published
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-800'
            }`}
          >
            {data.profile.is_published ? 'منشورة' : 'مسودة'}
          </span>
          <div className="inline-flex rounded-xl border border-line bg-white p-1 shadow-sm">
            <button
              type="button"
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                tab === 'preview' ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
              onClick={() => setTab('preview')}
            >
              <Eye className="h-4 w-4" />
              معاينة
            </button>
            <button
              type="button"
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                tab === 'edit' ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
              onClick={() => setTab('edit')}
            >
              <Pencil className="h-4 w-4" />
              تعديل
            </button>
          </div>
        </div>
      </div>

      {tab === 'preview' ? (
        <CvDocument
          data={previewData}
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
      ) : (
        <div className="space-y-6">
          <section className="panel p-4 sm:p-7">
            <h2 className="section-title">
              <User className="h-5 w-5 text-brand" />
              معلومات الملف الشخصي
            </h2>

            <div className="mb-6 flex flex-wrap items-center gap-4">
              {vms?.profilePictureUrl ? (
                <img
                  src={vms.profilePictureUrl}
                  alt=""
                  className="h-24 w-24 rounded-2xl border border-line object-cover shadow-sm sm:h-28 sm:w-28"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-400 sm:h-28 sm:w-28">
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

          <section className="panel p-4 sm:p-7">
            <h2 className="section-title">
              <GraduationCap className="h-5 w-5 text-brand" />
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

          <section className="panel p-4 sm:p-7">
            <h2 className="section-title">
              <Heart className="h-5 w-5 text-brand" />
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
                        className="rounded-xl border border-line bg-slate-50/80 p-3 sm:p-4"
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

          <section className="panel p-4 sm:p-7">
            <h2 className="section-title">
              <MapPinned className="h-5 w-5 text-brand" />
              تفضيلات العمل والراتب
            </h2>

            <div className="mb-4">
              <p className="label">أنواع العمل المتاحة حالياً</p>
              <p className="mb-2 text-xs text-slate-500">يمكن اختيار أكثر من نوع.</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {JOB_TYPE_OPTIONS.map((opt) => (
                  <label
                    key={opt.id}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm text-slate-700"
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

            <label className="flex items-start gap-3 rounded-xl border border-line bg-slate-50/80 p-3 text-sm text-slate-700">
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
                  placeholder="مثال: مستعد للانتقال داخل تركيا أو إلى دول الخليج خلال 3 أشهر"
                />
              </div>
            ) : null}

            <div className="mt-5">
              <p className="label">أماكن العمل المتوقعة والراتب الشهري (دوام كامل)</p>
              <p className="mb-3 text-xs text-slate-500">
                «عن بُعد» دائماً في أعلى القائمة. أضف دولاً مع نطاق الراتب المتوقع لكل خيار.
              </p>
              <ul className="space-y-3">
                {workPrefs.locations.map((loc, index) => (
                  <li key={`${loc.kind}-${loc.countryName || 'remote'}`} className="rounded-xl border border-line p-3 sm:p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="font-bold text-slate-900">
                        {loc.kind === 'remote' ? 'عن بُعد (Remote)' : loc.countryName}
                      </p>
                      {loc.kind === 'country' ? (
                        <button
                          type="button"
                          className="btn-danger py-1.5 text-xs"
                          onClick={() => removeLocation(index)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          حذف
                        </button>
                      ) : (
                        <span className="rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-semibold text-brand-ink">
                          أولاً في القائمة
                        </span>
                      )}
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
                          placeholder="مثال: 2000"
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
                          placeholder="مثال: 3500"
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
                  value=""
                  excludeNames={workPrefs.locations
                    .filter((loc) => loc.kind === 'country')
                    .map((loc) => loc.countryName || '')}
                  onChange={(name) => addCountryLocation(name)}
                  placeholder="ابحث واختر دولة للإضافة"
                />
              </div>
            </div>
          </section>

          <section className="panel p-4 sm:p-7">
            <h2 className="section-title">
              <Briefcase className="h-5 w-5 text-brand" />
              الخبرة العملية
            </h2>
            <ul className="space-y-3">
              {data.workExperiences?.map((item: any, index: number) => (
                <li key={item.id} className="rounded-xl border border-line p-4">
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
            </ul>

            <form
              className="mt-6 grid grid-cols-1 gap-4 border-t border-line pt-6 md:grid-cols-2"
              onSubmit={(e) => void addWork(e)}
            >
              <div>
                <label className="label">المسمى الوظيفي *</label>
                <input
                  className="field"
                  required
                  placeholder="مثال: مهندس برمجيات أول"
                  value={workForm.title}
                  onChange={(e) => setWorkForm((s) => ({ ...s, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">الشركة *</label>
                <input
                  className="field"
                  required
                  placeholder="مثال: جوجل، مايكروسوفت، شركة محلية"
                  value={workForm.company_name}
                  onChange={(e) => setWorkForm((s) => ({ ...s, company_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">الموقع</label>
                <input
                  className="field"
                  value={workForm.location}
                  onChange={(e) => setWorkForm((s) => ({ ...s, location: e.target.value }))}
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={workForm.is_current}
                    onChange={(e) => setWorkForm((s) => ({ ...s, is_current: e.target.checked }))}
                  />
                  أعمل هنا حالياً
                </label>
              </div>
              <div>
                <label className="label">تاريخ البداية</label>
                <input
                  className="field"
                  type="month"
                  value={workForm.start_date}
                  onChange={(e) => setWorkForm((s) => ({ ...s, start_date: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">تاريخ النهاية</label>
                <input
                  className="field"
                  type="month"
                  disabled={workForm.is_current}
                  value={workForm.end_date}
                  onChange={(e) => setWorkForm((s) => ({ ...s, end_date: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">المسؤوليات *</label>
                <textarea
                  className="field min-h-28"
                  required
                  placeholder="صف مسؤولياتك وتأثيرك بأرقام أو نتائج محددة عند الإمكان"
                  value={workForm.responsibilities}
                  onChange={(e) => setWorkForm((s) => ({ ...s, responsibilities: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">الإنجازات</label>
                <textarea
                  className="field min-h-24"
                  placeholder="اختياري: أبرز النتائج"
                  value={workForm.achievements}
                  onChange={(e) => setWorkForm((s) => ({ ...s, achievements: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <SkillPicker
                  available={availableSkills}
                  selected={workSkills}
                  onChange={setWorkSkills}
                  label="المهارات المكتسبة في هذه الخبرة"
                />
              </div>
              <button type="submit" className="btn-primary md:col-span-2">
                إضافة خبرة عملية
              </button>
            </form>
          </section>

          <section className="panel p-4 sm:p-7">
            <h2 className="section-title">
              <FolderKanban className="h-5 w-5 text-brand" />
              المشاريع
            </h2>
            <ul className="space-y-3">
              {data.projects?.map((item: any, index: number) => (
                <li key={item.id} className="rounded-xl border border-line p-4">
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

            <form
              className="mt-6 grid grid-cols-1 gap-4 border-t border-line pt-6 md:grid-cols-2"
              onSubmit={(e) => void addProject(e)}
            >
              <div>
                <label className="label">اسم المشروع *</label>
                <input
                  className="field"
                  required
                  placeholder="منصة تجارة إلكترونية، تطبيق جوال…"
                  value={projectForm.name}
                  onChange={(e) => setProjectForm((s) => ({ ...s, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">دورك</label>
                <input
                  className="field"
                  value={projectForm.role}
                  onChange={(e) => setProjectForm((s) => ({ ...s, role: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">الجهة / الشركة</label>
                <input
                  className="field"
                  value={projectForm.company}
                  onChange={(e) => setProjectForm((s) => ({ ...s, company: e.target.value }))}
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={projectForm.is_ongoing}
                    onChange={(e) => setProjectForm((s) => ({ ...s, is_ongoing: e.target.checked }))}
                  />
                  مشروع مستمر
                </label>
              </div>
              <div>
                <label className="label">البداية</label>
                <input
                  className="field"
                  type="month"
                  value={projectForm.start_date}
                  onChange={(e) => setProjectForm((s) => ({ ...s, start_date: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">النهاية</label>
                <input
                  className="field"
                  type="month"
                  disabled={projectForm.is_ongoing}
                  value={projectForm.end_date}
                  onChange={(e) => setProjectForm((s) => ({ ...s, end_date: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <SkillPicker
                  available={availableSkills}
                  selected={projectSkills}
                  onChange={setProjectSkills}
                  label="المهارات المكتسبة في هذا المشروع"
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">المسؤوليات</label>
                <textarea
                  className="field min-h-24"
                  value={projectForm.responsibilities}
                  onChange={(e) => setProjectForm((s) => ({ ...s, responsibilities: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">النتائج</label>
                <textarea
                  className="field min-h-24"
                  value={projectForm.outcomes}
                  onChange={(e) => setProjectForm((s) => ({ ...s, outcomes: e.target.value }))}
                />
              </div>
              <button type="submit" className="btn-primary md:col-span-2">
                إضافة مشروع
              </button>
            </form>
          </section>

          <section className="panel p-4 sm:p-7">
            <h2 className="section-title">السيرة والملفات</h2>
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
                  className="flex items-center justify-between rounded-xl border border-line px-4 py-3"
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
        </div>
      )}

      <div className="sticky bottom-4 z-10 flex flex-wrap gap-3 rounded-2xl border border-line bg-white/95 p-4 shadow-sheet backdrop-blur">
        <button
          type="button"
          className="btn-primary"
          disabled={saving}
          onClick={() => saveProfile()}
        >
          <Save className="h-4 w-4" />
          {saving ? 'جاري الحفظ…' : 'حفظ السيرة'}
        </button>
        <button type="button" className="btn-ghost" disabled={saving} onClick={() => togglePublish()}>
          {data.profile.is_published ? 'إلغاء النشر' : 'نشر السيرة للمراجعة'}
        </button>
        {tab === 'edit' ? (
          <button type="button" className="btn-ghost ms-auto" onClick={() => setTab('preview')}>
            <Eye className="h-4 w-4" />
            معاينة السيرة
          </button>
        ) : null}
      </div>

      <ChangelogModal
        open={changelogOpen}
        entries={changelogEntries}
        saving={saving}
        confirmLabel={
          pendingAction === 'publish'
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
