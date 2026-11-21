import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Filter, Inbox, Search, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { normalizeSearchText } from '../lib/countries'
import { sexLabel, splitCsv } from '../lib/profile-utils'
import {
  JOB_TYPE_OPTIONS,
  jobTypeLabel,
  normalizeWorkPreferences,
  type OpenJobType,
} from '../lib/work-preferences'
import { profilesApi } from '../services/api'

type TalentItem = {
  profile: {
    membership_number: string
    summary?: string | null
    headline?: string | null
    updated_at?: string
  }
  latestRole?: string | null
  accessRequestCount?: number
  workPreferences?: unknown
  vmsProfile?: {
    arName?: string | null
    enName?: string | null
    sex?: string | null
    educationLevel?: string | null
    school?: string | null
    fieldOfStudy?: string | null
    skills?: string | null
    languages?: string | null
    profilePictureUrl?: string | null
    country?: string | null
    region?: string | null
    city?: string | null
  } | null
}

type Filters = {
  q: string
  sex: '' | 'male' | 'female'
  country: string
  city: string
  skill: string
  language: string
  educationLevel: string
  school: string
  fieldOfStudy: string
  jobType: '' | OpenJobType
  canRelocate: '' | 'yes' | 'no'
  workLocation: string
}

const emptyFilters = (): Filters => ({
  q: '',
  sex: '',
  country: '',
  city: '',
  skill: '',
  language: '',
  educationLevel: '',
  school: '',
  fieldOfStudy: '',
  jobType: '',
  canRelocate: '',
  workLocation: '',
})

function displayName(item: TalentItem) {
  return item.vmsProfile?.arName || item.vmsProfile?.enName || item.profile.membership_number
}

function searchableBlob(item: TalentItem) {
  const skills = splitCsv(item.vmsProfile?.skills).join(' ')
  const languages = splitCsv(item.vmsProfile?.languages).join(' ')
  const prefs = normalizeWorkPreferences(item.workPreferences)
  const locations = prefs.locations
    .map((loc) => (loc.kind === 'remote' ? 'remote عن بعد' : loc.countryName || ''))
    .join(' ')
  return normalizeSearchText(
    [
      displayName(item),
      item.vmsProfile?.enName,
      item.latestRole,
      item.profile.summary,
      item.profile.headline,
      item.profile.membership_number,
      item.vmsProfile?.country,
      item.vmsProfile?.region,
      item.vmsProfile?.city,
      item.vmsProfile?.school,
      item.vmsProfile?.fieldOfStudy,
      item.vmsProfile?.educationLevel,
      sexLabel(item.vmsProfile?.sex),
      skills,
      languages,
      locations,
      prefs.jobTypes.map((id) => jobTypeLabel(id)).join(' '),
    ]
      .filter(Boolean)
      .join(' '),
  )
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'ar'),
  )
}

export default function TalentPage() {
  const [profiles, setProfiles] = useState<TalentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    void profilesApi
      .discover()
      .then((data) => setProfiles(data.profiles || []))
      .catch((err) => toast.error(err?.response?.data?.message || 'تعذّر تحميل السير'))
      .finally(() => setLoading(false))
  }, [])

  const options = useMemo(() => {
    const countries: string[] = []
    const cities: string[] = []
    const skills: string[] = []
    const languages: string[] = []
    const educationLevels: string[] = []
    const schools: string[] = []
    const fields: string[] = []
    const workLocations: string[] = []

    for (const item of profiles) {
      if (item.vmsProfile?.country) countries.push(item.vmsProfile.country)
      if (item.vmsProfile?.city) cities.push(item.vmsProfile.city)
      skills.push(...splitCsv(item.vmsProfile?.skills))
      languages.push(...splitCsv(item.vmsProfile?.languages))
      if (item.vmsProfile?.educationLevel) educationLevels.push(item.vmsProfile.educationLevel)
      if (item.vmsProfile?.school) schools.push(item.vmsProfile.school)
      if (item.vmsProfile?.fieldOfStudy) fields.push(item.vmsProfile.fieldOfStudy)
      const prefs = normalizeWorkPreferences(item.workPreferences)
      for (const loc of prefs.locations) {
        if (loc.kind === 'remote') workLocations.push('عن بُعد')
        else if (loc.countryName) workLocations.push(loc.countryName)
      }
    }

    return {
      countries: uniqueSorted(countries),
      cities: uniqueSorted(cities),
      skills: uniqueSorted(skills),
      languages: uniqueSorted(languages),
      educationLevels: uniqueSorted(educationLevels),
      schools: uniqueSorted(schools),
      fields: uniqueSorted(fields),
      workLocations: uniqueSorted(workLocations),
    }
  }, [profiles])

  const filtered = useMemo(() => {
    const q = normalizeSearchText(filters.q)
    return profiles.filter((item) => {
      if (q && !searchableBlob(item).includes(q)) return false

      if (filters.sex) {
        if ((item.vmsProfile?.sex || '').trim() !== filters.sex) return false
      }

      if (filters.country) {
        const country = (item.vmsProfile?.country || '').trim()
        if (country !== filters.country) return false
      }

      if (filters.city) {
        if ((item.vmsProfile?.city || '').trim() !== filters.city) return false
      }

      if (filters.skill) {
        const skills = splitCsv(item.vmsProfile?.skills).map((s) => s.toLowerCase())
        if (!skills.includes(filters.skill.toLowerCase())) return false
      }

      if (filters.language) {
        const languages = splitCsv(item.vmsProfile?.languages).map((s) => s.toLowerCase())
        if (!languages.includes(filters.language.toLowerCase())) return false
      }

      if (filters.educationLevel) {
        if ((item.vmsProfile?.educationLevel || '').trim() !== filters.educationLevel) return false
      }

      if (filters.school) {
        if ((item.vmsProfile?.school || '').trim() !== filters.school) return false
      }

      if (filters.fieldOfStudy) {
        if ((item.vmsProfile?.fieldOfStudy || '').trim() !== filters.fieldOfStudy) return false
      }

      const prefs = normalizeWorkPreferences(item.workPreferences)

      if (filters.jobType && !prefs.jobTypes.includes(filters.jobType)) return false

      if (filters.canRelocate === 'yes' && !prefs.canRelocate) return false
      if (filters.canRelocate === 'no' && prefs.canRelocate) return false

      if (filters.workLocation) {
        if (filters.workLocation === 'عن بُعد') {
          if (!prefs.locations.some((loc) => loc.kind === 'remote')) return false
        } else if (
          !prefs.locations.some(
            (loc) => loc.kind === 'country' && loc.countryName === filters.workLocation,
          )
        ) {
          return false
        }
      }

      return true
    })
  }, [profiles, filters])

  const activeFilterCount = [
    filters.sex,
    filters.country,
    filters.city,
    filters.skill,
    filters.language,
    filters.educationLevel,
    filters.school,
    filters.fieldOfStudy,
    filters.jobType,
    filters.canRelocate,
    filters.workLocation,
  ].filter(Boolean).length

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-end sm:justify-between sm:border-0 sm:pb-0">
        <div>
          <p className="page-kicker">اكتشاف</p>
          <h1 className="page-title">السير العامة</h1>
          <p className="page-desc">تصفح السير التي اختار أصحابها جعلها عامة.</p>
        </div>
        <p className="text-sm text-muted">
          {loading ? 'جاري التحميل…' : `${filtered.length} من ${profiles.length} سيرة`}
        </p>
      </div>

      <div className="panel p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative w-full min-w-0 flex-1 sm:min-w-[12rem]">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="field ps-9"
              value={filters.q}
              onChange={(e) => setFilter('q', e.target.value)}
              placeholder="بحث بالاسم، المهارة، المسمى…"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className={`btn-ghost flex-1 sm:flex-none ${filtersOpen ? 'border-brand text-brand-ink' : ''}`}
              onClick={() => setFiltersOpen((v) => !v)}
            >
              <Filter className="h-4 w-4" />
              تصفية
              {activeFilterCount > 0 ? (
                <span className="status-pill text-[10px]">{activeFilterCount}</span>
              ) : null}
            </button>
            {(activeFilterCount > 0 || filters.q) && (
              <button
                type="button"
                className="btn-ghost flex-1 sm:flex-none"
                onClick={() => setFilters(emptyFilters())}
              >
                <X className="h-4 w-4" />
                مسح
              </button>
            )}
          </div>
        </div>

        {filtersOpen ? (
          <div className="mt-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="label">الجنس</label>
              <select
                className="field"
                value={filters.sex}
                onChange={(e) => setFilter('sex', e.target.value as Filters['sex'])}
              >
                <option value="">الكل</option>
                <option value="male">{sexLabel('male')}</option>
                <option value="female">{sexLabel('female')}</option>
              </select>
            </div>

            <div>
              <label className="label">بلد الإقامة</label>
              <select
                className="field"
                value={filters.country}
                onChange={(e) => setFilter('country', e.target.value)}
              >
                <option value="">الكل</option>
                {options.countries.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">المدينة</label>
              <select
                className="field"
                value={filters.city}
                onChange={(e) => setFilter('city', e.target.value)}
              >
                <option value="">الكل</option>
                {options.cities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">مهارة</label>
              <select
                className="field"
                value={filters.skill}
                onChange={(e) => setFilter('skill', e.target.value)}
              >
                <option value="">الكل</option>
                {options.skills.map((skill) => (
                  <option key={skill} value={skill}>
                    {skill}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">اللغة</label>
              <select
                className="field"
                value={filters.language}
                onChange={(e) => setFilter('language', e.target.value)}
              >
                <option value="">الكل</option>
                {options.languages.map((language) => (
                  <option key={language} value={language}>
                    {language}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">المستوى التعليمي</label>
              <select
                className="field"
                value={filters.educationLevel}
                onChange={(e) => setFilter('educationLevel', e.target.value)}
              >
                <option value="">الكل</option>
                {options.educationLevels.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">المدرسة / الجامعة</label>
              <select
                className="field"
                value={filters.school}
                onChange={(e) => setFilter('school', e.target.value)}
              >
                <option value="">الكل</option>
                {options.schools.map((school) => (
                  <option key={school} value={school}>
                    {school}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">مجال الدراسة</label>
              <select
                className="field"
                value={filters.fieldOfStudy}
                onChange={(e) => setFilter('fieldOfStudy', e.target.value)}
              >
                <option value="">الكل</option>
                {options.fields.map((field) => (
                  <option key={field} value={field}>
                    {field}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">نوع العمل المتاح</label>
              <select
                className="field"
                value={filters.jobType}
                onChange={(e) => setFilter('jobType', e.target.value as Filters['jobType'])}
              >
                <option value="">الكل</option>
                {JOB_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.labelAr}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">إمكانية الانتقال</label>
              <select
                className="field"
                value={filters.canRelocate}
                onChange={(e) => setFilter('canRelocate', e.target.value as Filters['canRelocate'])}
              >
                <option value="">الكل</option>
                <option value="yes">نعم</option>
                <option value="no">لا</option>
              </select>
            </div>

            <div>
              <label className="label">مكان عمل مفضّل</label>
              <select
                className="field"
                value={filters.workLocation}
                onChange={(e) => setFilter('workLocation', e.target.value)}
              >
                <option value="">الكل</option>
                {options.workLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}
      </div>

      <div className="panel overflow-hidden">
        {loading ? (
          <p className="px-4 py-12 text-center text-sm text-muted">جاري تحميل السير…</p>
        ) : (
          <>
            <ul className="divide-y divide-line">
              {filtered.map((item) => {
                const name = displayName(item)
                const initials = String(name)
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((p: string) => Array.from(p.replace(/\./g, ''))[0] || '')
                  .filter(Boolean)
                  .join('')
                const prefs = normalizeWorkPreferences(item.workPreferences)
                const requestCount = Number(item.accessRequestCount || 0)
                const meta = [
                  item.vmsProfile?.country,
                  item.vmsProfile?.fieldOfStudy,
                  prefs.canRelocate ? 'قابل للانتقال' : null,
                ]
                  .filter(Boolean)
                  .join(' · ')

                return (
                  <li key={item.profile.membership_number}>
                    <Link
                      to={`/talent/${item.profile.membership_number}`}
                      className="flex items-start gap-3 px-4 py-4 transition hover:bg-slate-50/80 sm:px-5"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-brand-light text-xs font-bold text-brand-ink">
                        {initials || '؟'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <h2 className="truncate font-semibold text-ink">{name}</h2>
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex items-center gap-1 text-xs font-semibold tabular-nums text-slate-500"
                              title={
                                requestCount > 0
                                  ? `${requestCount} طلب اطلاع · إجمالي عام بدون تفاصيل`
                                  : 'لا طلبات اطلاع بعد'
                              }
                            >
                              <Inbox className="h-3.5 w-3.5 text-slate-400" />
                              {requestCount}
                            </span>
                            <span className="text-xs font-medium text-brand">
                              {item.latestRole || 'بدون مسمى'}
                            </span>
                          </div>
                        </div>
                        {meta ? <p className="mt-0.5 text-xs text-muted">{meta}</p> : null}
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted">
                          {item.profile.summary || 'لا توجد نبذة بعد.'}
                        </p>
                        {!!prefs.jobTypes.length && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {prefs.jobTypes.map((id) => (
                              <span key={id} className="chip">
                                {jobTypeLabel(id)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
            {!filtered.length && (
              <p className="px-4 py-12 text-center text-sm text-muted">
                لا توجد سير مطابقة للتصفية الحالية.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
