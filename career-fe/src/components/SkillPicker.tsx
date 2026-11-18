import { useMemo, useState } from 'react'

export type SkillOption = {
  skillId?: string
  name: string
}

type Props = {
  available: SkillOption[]
  selected: SkillOption[]
  onChange: (next: SkillOption[]) => void
  label?: string
}

function keyOf(skill: SkillOption) {
  return (skill.skillId || skill.name).toLowerCase()
}

export function SkillPicker({
  available,
  selected,
  onChange,
  label = 'المهارات المكتسبة',
}: Props) {
  const [query, setQuery] = useState('')

  const selectedKeys = useMemo(() => new Set(selected.map(keyOf)), [selected])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return available.filter((skill) => {
      if (selectedKeys.has(keyOf(skill))) return false
      if (!needle) return true
      return skill.name.toLowerCase().includes(needle)
    })
  }, [available, query, selectedKeys])

  const addExisting = (skill: SkillOption) => {
    if (selectedKeys.has(keyOf(skill))) return
    onChange([...selected, skill])
    setQuery('')
  }

  const addNew = () => {
    const name = query.trim()
    if (!name) return
    if (selectedKeys.has(name.toLowerCase())) {
      setQuery('')
      return
    }
    const existing = available.find((s) => s.name.toLowerCase() === name.toLowerCase())
    onChange([...selected, existing || { name }])
    setQuery('')
  }

  const remove = (skill: SkillOption) => {
    onChange(selected.filter((item) => keyOf(item) !== keyOf(skill)))
  }

  return (
    <div className="space-y-3">
      <label className="label">{label}</label>
      <p className="text-xs text-gray-500">
        اختر من مهاراتك في منصة الأعضاء، أو اكتب مهارة جديدة لإضافتها إلى ملفك وربطها هنا.
      </p>

      <div className="flex flex-wrap gap-2">
        {selected.map((skill) => (
          <button
            key={keyOf(skill)}
            type="button"
            className="chip border border-rich-gold/40"
            onClick={() => remove(skill)}
            title="إزالة"
          >
            {skill.name} ×
          </button>
        ))}
        {!selected.length && <span className="text-sm text-gray-500">لم تُختر مهارات بعد.</span>}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          className="field max-w-sm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث أو اكتب مهارة جديدة"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (filtered[0]) addExisting(filtered[0])
              else addNew()
            }
          }}
        />
        <button type="button" className="btn-ghost" onClick={addNew} disabled={!query.trim()}>
          إضافة مهارة
        </button>
      </div>

      {!!filtered.length && (
        <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto rounded-xl border border-gray-200 bg-sand/40 p-3">
          {filtered.map((skill) => (
            <button
              key={keyOf(skill)}
              type="button"
              className="chip hover:border hover:border-rich-gold"
              onClick={() => addExisting(skill)}
            >
              + {skill.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
