import { FormEvent, useState } from 'react'
import { Plus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { SkillPicker, type SkillOption } from './SkillPicker'
import { profilesApi } from '../services/api'

const emptyForm = {
  company_name: '',
  title: '',
  location: '',
  start_date: '',
  end_date: '',
  is_current: false,
  responsibilities: '',
  achievements: '',
}

type Props = {
  availableSkills: SkillOption[]
  onAdded: () => Promise<void> | void
}

export function AddWorkExperienceForm({ availableSkills, onAdded }: Props) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [skills, setSkills] = useState<SkillOption[]>([])
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setForm(emptyForm)
    setSkills([])
  }

  const close = () => {
    reset()
    setOpen(false)
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    try {
      await profilesApi.addWork({
        ...form,
        description: form.responsibilities,
        skills,
      })
      reset()
      setOpen(false)
      toast.success('تمت إضافة الخبرة')
      await onAdded()
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn-ghost mt-4 w-full sm:w-auto" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        إضافة خبرة جديدة
      </button>
    )
  }

  return (
    <div className="mt-5 rounded-lg border border-slate-300 bg-slate-100/90 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-800">خبرة عملية جديدة</h3>
        <button type="button" className="btn-ghost py-1.5 text-xs" onClick={close} disabled={submitting}>
          <X className="h-3.5 w-3.5" />
          إلغاء
        </button>
      </div>

      <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={(e) => void onSubmit(e)}>
        <div>
          <label className="label">المسمى الوظيفي *</label>
          <input
            className="field"
            required
            placeholder="مثال: مهندس برمجيات أول"
            value={form.title}
            onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">الشركة *</label>
          <input
            className="field"
            required
            placeholder="مثال: جوجل، مايكروسوفت، شركة محلية"
            value={form.company_name}
            onChange={(e) => setForm((s) => ({ ...s, company_name: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">الموقع</label>
          <input
            className="field"
            value={form.location}
            onChange={(e) => setForm((s) => ({ ...s, location: e.target.value }))}
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.is_current}
              onChange={(e) => setForm((s) => ({ ...s, is_current: e.target.checked }))}
            />
            أعمل هنا حالياً
          </label>
        </div>
        <div>
          <label className="label">تاريخ البداية</label>
          <input
            className="field"
            type="month"
            value={form.start_date}
            onChange={(e) => setForm((s) => ({ ...s, start_date: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">تاريخ النهاية</label>
          <input
            className="field"
            type="month"
            disabled={form.is_current}
            value={form.end_date}
            onChange={(e) => setForm((s) => ({ ...s, end_date: e.target.value }))}
          />
        </div>
        <div className="md:col-span-2">
          <label className="label">المسؤوليات *</label>
          <textarea
            className="field min-h-28"
            required
            placeholder="صف مسؤولياتك وتأثيرك بأرقام أو نتائج محددة عند الإمكان"
            value={form.responsibilities}
            onChange={(e) => setForm((s) => ({ ...s, responsibilities: e.target.value }))}
          />
        </div>
        <div className="md:col-span-2">
          <label className="label">الإنجازات</label>
          <textarea
            className="field min-h-24"
            placeholder="اختياري: أبرز النتائج"
            value={form.achievements}
            onChange={(e) => setForm((s) => ({ ...s, achievements: e.target.value }))}
          />
        </div>
        <div className="md:col-span-2">
          <SkillPicker
            available={availableSkills}
            selected={skills}
            onChange={setSkills}
            label="المهارات المكتسبة في هذه الخبرة"
          />
        </div>
        <button type="submit" className="btn-primary md:col-span-2" disabled={submitting}>
          {submitting ? 'جارٍ الإضافة…' : 'إضافة خبرة عملية'}
        </button>
      </form>
    </div>
  )
}
