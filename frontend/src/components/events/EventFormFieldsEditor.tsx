import { Plus, Trash2 } from 'lucide-react'
import type { VmsEventFormField, VmsEventFormFieldType } from '../../types/vms'

const FIELD_TYPES: Array<{ value: VmsEventFormFieldType; label: string }> = [
  { value: 'text', label: 'نص قصير' },
  { value: 'textarea', label: 'نص طويل' },
  { value: 'email', label: 'بريد إلكتروني' },
  { value: 'phone', label: 'هاتف' },
  { value: 'url', label: 'رابط' },
  { value: 'number', label: 'رقم' },
]

type DraftField = {
  key: string
  label: string
  description: string
  type: VmsEventFormFieldType
  required: boolean
}

type EventFormFieldsEditorProps = {
  fields: DraftField[]
  onChange: (fields: DraftField[]) => void
  disabled?: boolean
}

export function createDraftFormField(overrides?: Partial<DraftField>): DraftField {
  return {
    key: `new-${crypto.randomUUID()}`,
    label: '',
    description: '',
    type: 'text',
    required: true,
    ...overrides,
  }
}

export function eventFieldsToDraft(fields: VmsEventFormField[]): DraftField[] {
  return fields.map((field) => ({
    key: field.id,
    label: field.label,
    description: field.description ?? '',
    type: field.type,
    required: field.required,
  }))
}

export function startupApplicationPreset(): DraftField[] {
  return [
    createDraftFormField({ label: 'اسم الشركة أو المشروع', type: 'text' }),
    createDraftFormField({ label: 'مجال الشركة / الفريق', type: 'text' }),
    createDraftFormField({ label: 'سنة التأسيس', type: 'number' }),
    createDraftFormField({ label: 'أسماء أعضاء الفريق', type: 'textarea' }),
    createDraftFormField({ label: 'الموقع الإلكتروني', type: 'url' }),
    createDraftFormField({
      label: 'اذكر شرح للمشروع المقدم من فضلك / نشاط الفريق',
      description: 'ما المشكلة التي تحلونها؟ وما الحل أو المنتج الذي تقدمونه؟ وما الذي يميز الحل عن البدائل الموجودة؟',
      type: 'textarea',
    }),
  ]
}

export function EventFormFieldsEditor({ fields, onChange, disabled }: EventFormFieldsEditorProps) {
  function updateField(key: string, patch: Partial<DraftField>) {
    onChange(fields.map((field) => (field.key === key ? { ...field, ...patch } : field)))
  }

  return (
    <div className="space-y-3">
      {fields.length === 0 ? (
        <p className="text-sm leading-6 text-slate-500">
          لا توجد أسئلة بعد. الاسم الكامل والبريد ورقم الهاتف تُجمع تلقائياً. أضف الأسئلة الإضافية التي تريد جمعها من المتقدمين.
        </p>
      ) : (
        <ul className="space-y-3">
          {fields.map((field, index) => (
            <li key={field.key} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-500">سؤال {index + 1}</p>
                <button
                  type="button"
                  onClick={() => onChange(fields.filter((item) => item.key !== field.key))}
                  disabled={disabled}
                  className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-600 hover:bg-red-100 disabled:opacity-60"
                  aria-label="حذف السؤال"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 md:col-span-2">
                  <span className="text-xs font-medium text-slate-700">نص السؤال</span>
                  <input
                    type="text"
                    value={field.label}
                    onChange={(event) => updateField(field.key, { label: event.target.value })}
                    placeholder="مثال: اسم الشركة أو المشروع"
                    disabled={disabled}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-slate-700">نوع الحقل</span>
                  <select
                    value={field.type}
                    onChange={(event) => updateField(field.key, { type: event.target.value as VmsEventFormFieldType })}
                    disabled={disabled}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                  >
                    {FIELD_TYPES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(event) => updateField(field.key, { required: event.target.checked })}
                    disabled={disabled}
                    className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                  />
                  سؤال إلزامي
                </label>
                <label className="space-y-1 md:col-span-2">
                  <span className="text-xs font-medium text-slate-700">نص مساعد (اختياري)</span>
                  <textarea
                    value={field.description}
                    onChange={(event) => updateField(field.key, { description: event.target.value })}
                    placeholder="توضيح يظهر تحت السؤال"
                    rows={2}
                    disabled={disabled}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                  />
                </label>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onChange([...fields, createDraftFormField()])}
          disabled={disabled || fields.length >= 40}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          إضافة سؤال
        </button>
        {fields.length === 0 ? (
          <button
            type="button"
            onClick={() => onChange(startupApplicationPreset())}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-800 shadow-sm transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            تعبئة أسئلة الشركات الناشئة
          </button>
        ) : null}
      </div>
    </div>
  )
}
