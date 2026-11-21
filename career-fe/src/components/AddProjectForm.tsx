import { FormEvent, useState } from 'react'
import { Plus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { SkillPicker, type SkillOption } from './SkillPicker'
import { profilesApi } from '../services/api'

const emptyForm = {
  name: '',
  role: '',
  company: '',
  project_type: 'personal',
  start_date: '',
  end_date: '',
  is_ongoing: false,
  responsibilities: '',
  outcomes: '',
}

type Props = {
  availableSkills: SkillOption[]
  onAdded: () => Promise<void> | void
}

export function AddProjectForm({ availableSkills, onAdded }: Props) {
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
      await profilesApi.addProject({
        ...form,
        skills,
      })
      reset()
      setOpen(false)
      toast.success('تمت إضافة المشروع')
      await onAdded()
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn-ghost mt-4 w-full sm:w-auto" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        إضافة مشروع جديد
      </button>
    )
  }

  return (
    <div className="mt-5 rounded-lg border border-slate-300 bg-slate-100/90 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-800">مشروع جديد</h3>
        <button type="button" className="btn-ghost py-1.5 text-xs" onClick={close} disabled={submitting}>
          <X className="h-3.5 w-3.5" />
          إلغاء
        </button>
      </div>

      <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={(e) => void onSubmit(e)}>
        <div>
          <label className="label">اسم المشروع *</label>
          <input
            className="field"
            required
            placeholder="منصة تجارة إلكترونية، تطبيق جوال…"
            value={form.name}
            onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">دورك</label>
          <input
            className="field"
            value={form.role}
            onChange={(e) => setForm((s) => ({ ...s, role: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">الجهة / الشركة</label>
          <input
            className="field"
            value={form.company}
            onChange={(e) => setForm((s) => ({ ...s, company: e.target.value }))}
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.is_ongoing}
              onChange={(e) => setForm((s) => ({ ...s, is_ongoing: e.target.checked }))}
            />
            مشروع مستمر
          </label>
        </div>
        <div>
          <label className="label">البداية</label>
          <input
            className="field"
            type="month"
            value={form.start_date}
            onChange={(e) => setForm((s) => ({ ...s, start_date: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">النهاية</label>
          <input
            className="field"
            type="month"
            disabled={form.is_ongoing}
            value={form.end_date}
            onChange={(e) => setForm((s) => ({ ...s, end_date: e.target.value }))}
          />
        </div>
        <div className="md:col-span-2">
          <SkillPicker
            available={availableSkills}
            selected={skills}
            onChange={setSkills}
            label="المهارات المكتسبة في هذا المشروع"
          />
        </div>
        <div className="md:col-span-2">
          <label className="label">المسؤوليات</label>
          <textarea
            className="field min-h-24"
            value={form.responsibilities}
            onChange={(e) => setForm((s) => ({ ...s, responsibilities: e.target.value }))}
          />
        </div>
        <div className="md:col-span-2">
          <label className="label">النتائج</label>
          <textarea
            className="field min-h-24"
            value={form.outcomes}
            onChange={(e) => setForm((s) => ({ ...s, outcomes: e.target.value }))}
          />
        </div>
        <button type="submit" className="btn-primary md:col-span-2" disabled={submitting}>
          {submitting ? 'جارٍ الإضافة…' : 'إضافة مشروع'}
        </button>
      </form>
    </div>
  )
}
