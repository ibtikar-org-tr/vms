import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Briefcase, FolderKanban, GraduationCap, Heart, Languages, Save, User } from 'lucide-react'
import toast from 'react-hot-toast'
import { SkillPicker, type SkillOption } from '../components/SkillPicker'
import { getVmsProfileUrl } from '../lib/vms-sso'
import { authDownloadHeaders, profilesApi } from '../services/api'

function splitCsv(value?: string | null): string[] {
  if (!value?.trim()) return []
  return value
    .split(/[,،\n]/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function sexLabel(sex?: string | null) {
  if (sex === 'male') return 'ذكر'
  if (sex === 'female') return 'أنثى'
  return '—'
}

export default function ProfilePage() {
  const [data, setData] = useState<any>(null)
  const [summary, setSummary] = useState('')
  const [saving, setSaving] = useState(false)
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
    setSummary(payload.profile?.summary || '')
  }

  useEffect(() => {
    void load().catch(() => toast.error('تعذّر تحميل السيرة'))
  }, [])

  const skills = useMemo(() => splitCsv(data?.vmsProfile?.skills), [data])
  const interests = useMemo(() => splitCsv(data?.vmsProfile?.interests), [data])
  const languages = useMemo(() => splitCsv(data?.vmsProfile?.languages), [data])
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

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      await profilesApi.updateMe({ summary })
      toast.success('تم حفظ السيرة')
      await load()
    } finally {
      setSaving(false)
    }
  }

  const togglePublish = async () => {
    await profilesApi.updateMe({ summary, is_published: !data?.profile?.is_published })
    toast.success(data?.profile?.is_published ? 'تم إلغاء النشر' : 'تم نشر السيرة')
    await load()
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
        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-rich-gold" />
        <p className="text-gray-700">جاري تحميل بيانات سيرتك…</p>
      </div>
    )
  }

  const vms = data.vmsProfile
  const displayName = vms?.arName || vms?.enName || data.profile.membership_number

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="px-2 text-center">
        <h1 className="text-2xl font-bold text-carbon sm:text-4xl">تعديل السيرة الذاتية</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-gray-700 sm:text-lg">
          قم بتحديث معلومات سيرتك أدناه. البيانات الشخصية والتعليم والمهارات تُجلب من منصة الأعضاء ولا
          تُعدّل هنا.
        </p>
        <p className="mt-2 text-sm text-rich-gold">أنت تحرر سيرة {displayName}</p>
      </div>

      {/* Personal info from VMS */}
      <section className="panel mx-2 p-4 sm:mx-0 sm:p-8">
        <h2 className="section-title">
          <User className="h-5 w-5 text-rich-gold sm:h-6 sm:w-6" />
          معلومات الملف الشخصي
        </h2>

        <div className="mb-6 flex flex-wrap items-center gap-4">
          {vms?.profilePictureUrl ? (
            <img
              src={vms.profilePictureUrl}
              alt=""
              className="h-24 w-24 rounded-lg border-2 border-gray-200 object-cover sm:h-32 sm:w-32"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-sand text-sm text-gray-500 sm:h-32 sm:w-32">
              بلا صورة
            </div>
          )}
          <div className="space-y-2 text-sm text-gray-600">
            <p>الصورة والبيانات الشخصية تُدار في منصة الأعضاء.</p>
            <a className="btn-ghost" href={getVmsProfileUrl()} target="_blank" rel="noreferrer">
              تعديل الملف / الصورة في منصة الأعضاء
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
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
            <label className="label">المدينة / الدولة</label>
            <input
              className="field-readonly"
              readOnly
              value={[vms?.city, vms?.country].filter(Boolean).join(' · ') || '—'}
            />
          </div>
          <div>
            <label className="label">الجنس</label>
            <input className="field-readonly" readOnly value={sexLabel(vms?.sex)} />
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

      {/* Academic from VMS */}
      <section className="panel mx-2 p-4 sm:mx-0 sm:p-8">
        <h2 className="section-title">
          <GraduationCap className="h-5 w-5 text-rich-gold sm:h-6 sm:w-6" />
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
        <p className="mt-3 text-xs text-gray-500">لتعديل التعليم، حدّث ملفك في منصة الأعضاء.</p>
      </section>

      {/* Skills / interests / languages from VMS */}
      <section className="panel mx-2 p-4 sm:mx-0 sm:p-8">
        <h2 className="section-title">
          <Heart className="h-5 w-5 text-rich-gold sm:h-6 sm:w-6" />
          المهارات والاهتمامات واللغات
        </h2>
        <div className="space-y-5">
          <div>
            <p className="label">المهارات</p>
            <div className="flex flex-wrap gap-2">
              {skills.length ? skills.map((item) => <span key={item} className="chip">{item}</span>) : <span className="text-sm text-gray-500">لا توجد مهارات مضافة في منصة الأعضاء بعد.</span>}
            </div>
          </div>
          <div>
            <p className="label">الاهتمامات</p>
            <div className="flex flex-wrap gap-2">
              {interests.length ? interests.map((item) => <span key={item} className="chip">{item}</span>) : <span className="text-sm text-gray-500">لا توجد اهتمامات مضافة بعد.</span>}
            </div>
          </div>
          <div>
            <p className="label flex items-center gap-2">
              <Languages className="h-4 w-4 text-rich-gold" />
              اللغات
            </p>
            <div className="flex flex-wrap gap-2">
              {languages.length ? languages.map((item) => <span key={item} className="chip">{item}</span>) : <span className="text-sm text-gray-500">لا توجد لغات مضافة بعد.</span>}
            </div>
          </div>
        </div>
      </section>

      {/* Work experience */}
      <section className="panel mx-2 p-4 sm:mx-0 sm:p-8">
        <h2 className="section-title">
          <Briefcase className="h-5 w-5 text-rich-gold sm:h-6 sm:w-6" />
          الخبرة العملية
        </h2>
        <ul className="space-y-4">
          {data.workExperiences?.map((item: any, index: number) => (
            <li key={item.id} className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-rich-gold">الخبرة العملية #{index + 1}</p>
                  <p className="mt-1 font-semibold">
                    {item.title} · {item.company_name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {item.start_date || '؟'} — {item.is_current ? 'حالياً' : item.end_date || '؟'}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
                    {item.responsibilities || item.description}
                  </p>
                  {item.achievements ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{item.achievements}</p>
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
                  className="btn-danger"
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

        <form className="mt-6 grid grid-cols-1 gap-4 border-t border-gray-100 pt-6 md:grid-cols-2" onSubmit={(e) => void addWork(e)}>
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
            <label className="flex items-center gap-2 text-sm font-medium">
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

      {/* Projects */}
      <section className="panel mx-2 p-4 sm:mx-0 sm:p-8">
        <h2 className="section-title">
          <FolderKanban className="h-5 w-5 text-rich-gold sm:h-6 sm:w-6" />
          المشاريع
        </h2>
        <ul className="space-y-4">
          {data.projects?.map((item: any, index: number) => (
            <li key={item.id} className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-rich-gold">المشروع {index + 1}</p>
                  <p className="mt-1 font-semibold">{item.name}</p>
                  <p className="text-sm text-gray-500">
                    {[item.role, item.company].filter(Boolean).join(' · ')}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{item.responsibilities}</p>
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
                  className="btn-danger"
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
          {!data.projects?.length && <p className="text-sm text-gray-500">لا توجد مشاريع بعد.</p>}
        </ul>

        <form className="mt-6 grid grid-cols-1 gap-4 border-t border-gray-100 pt-6 md:grid-cols-2" onSubmit={(e) => void addProject(e)}>
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
            <label className="flex items-center gap-2 text-sm font-medium">
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

      {/* Files */}
      <section className="panel mx-2 p-4 sm:mx-0 sm:p-8">
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
            <li key={doc.id} className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
              <div>
                <p className="font-semibold">{doc.file_name}</p>
                <p className="text-xs text-gray-500">{doc.kind === 'cv' ? 'سيرة ذاتية' : 'ملف أعمال'}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-ghost"
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
                  className="btn-danger"
                  onClick={() =>
                    void profilesApi.deleteDocument(doc.id).then(load).then(() => toast.success('تم الحذف'))
                  }
                >
                  حذف
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="sticky bottom-4 z-10 mx-2 flex flex-wrap gap-3 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-lg backdrop-blur sm:mx-0">
        <button type="button" className="btn-primary" disabled={saving} onClick={(e) => void saveProfile(e as any)}>
          <Save className="h-4 w-4" />
          {saving ? 'جاري الحفظ…' : 'حفظ السيرة'}
        </button>
        <button type="button" className="btn-ghost" onClick={() => void togglePublish()}>
          {data.profile.is_published ? 'إلغاء النشر' : 'نشر السيرة للمراجعة'}
        </button>
      </div>
    </div>
  )
}
