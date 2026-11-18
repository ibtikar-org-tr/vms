import type { CvDocumentData } from '../components/CvDocument'
import {
  displayNameOf,
  formatBirthDate,
  formatDateRange,
  formatLocation,
  latestRoleOf,
  sexLabel,
  splitCsv,
} from './profile-utils'
import { publicCvUrl } from './cv-url'

function languagesOf(data: CvDocumentData) {
  if (data.languages?.length) return data.languages
  return splitCsv(data.vmsProfile?.languages).map((language) => ({
    language,
    proficiency: null as number | null,
    openToTranslate: false,
  }))
}

function safeFileName(name: string) {
  return (
    name
      .replace(/[^\w\u0600-\u06FF\- ]+/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 80) || 'CV'
  )
}

export function buildCvMarkdown(data: CvDocumentData): string {
  const vms = data.vmsProfile
  const name = displayNameOf(data)
  const role = latestRoleOf(data.workExperiences)
  const skills = splitCsv(vms?.skills)
  const interests = splitCsv(vms?.interests)
  const languages = languagesOf(data)
  const location = formatLocation({
    country: vms?.country,
    region: vms?.region,
    city: vms?.city,
  })
  const birthDate = formatBirthDate(vms?.dateOfBirth)
  const sex = sexLabel(vms?.sex)
  const cvUrl = data.profile.membership_number
    ? publicCvUrl(data.profile.membership_number)
    : ''

  const lines: string[] = []
  lines.push(`# ${name}`)
  if (role) lines.push(`**${role}**`)
  lines.push('')
  const contact = [
    vms?.email,
    vms?.phoneNumber,
    location,
    sex !== '—' ? sex : null,
    birthDate ? `DOB: ${birthDate}` : null,
  ].filter(Boolean)
  if (contact.length) lines.push(contact.join(' · '))
  if (cvUrl) lines.push(`[Online CV](${cvUrl})`)
  lines.push('')

  if (data.profile.summary) {
    lines.push('## Professional Summary / النبذة المهنية')
    lines.push('')
    lines.push(data.profile.summary.trim())
    lines.push('')
  }

  if (data.workExperiences?.length) {
    lines.push('## Work Experience / الخبرة العملية')
    lines.push('')
    for (const item of data.workExperiences) {
      lines.push(
        `### ${item.title || '—'}${item.company_name ? ` — ${item.company_name}` : ''}`,
      )
      lines.push(
        `*${formatDateRange(item.start_date, item.end_date, item.is_current, 'Present')}*${
          item.location ? ` · ${item.location}` : ''
        }`,
      )
      lines.push('')
      const body = item.responsibilities || item.description
      if (body) lines.push(body.trim(), '')
      if (item.achievements) lines.push(item.achievements.trim(), '')
      if (item.skills?.length) {
        lines.push(`Skills: ${item.skills.map((s) => s.name).join(', ')}`)
        lines.push('')
      }
    }
  }

  const education = [vms?.fieldOfStudy, vms?.educationLevel, vms?.school]
    .filter(Boolean)
    .join(' · ')
  if (education) {
    lines.push('## Education / التعليم')
    lines.push('')
    lines.push(`**${vms?.fieldOfStudy || vms?.educationLevel || 'Education'}**`)
    lines.push(
      [vms?.school, vms?.educationLevel, vms?.graduationYear ? `Class of ${vms.graduationYear}` : null]
        .filter(Boolean)
        .join(' · '),
    )
    lines.push('')
  }

  if (data.projects?.length) {
    lines.push('## Projects / المشاريع')
    lines.push('')
    for (const item of data.projects) {
      lines.push(`### ${item.name || '—'}`)
      const meta = [item.role, item.company].filter(Boolean).join(' · ')
      if (meta) lines.push(`*${meta}*`)
      if (item.start_date || item.end_date || item.is_ongoing) {
        lines.push(
          `*${formatDateRange(item.start_date, item.end_date, item.is_ongoing, 'Ongoing')}*`,
        )
      }
      lines.push('')
      if (item.responsibilities) lines.push(item.responsibilities.trim(), '')
      if (item.outcomes) lines.push(item.outcomes.trim(), '')
      if (item.skills?.length) {
        lines.push(`Skills: ${item.skills.map((s) => s.name).join(', ')}`)
        lines.push('')
      }
    }
  }

  if (skills.length) {
    lines.push('## Skills / المهارات')
    lines.push('')
    lines.push(skills.map((s) => `- ${s}`).join('\n'))
    lines.push('')
  }

  if (languages.length) {
    lines.push('## Languages / اللغات')
    lines.push('')
    for (const lang of languages) {
      const level = lang.proficiency != null ? ` (${lang.proficiency}/10)` : ''
      const translate = lang.openToTranslate ? ' — open to translation' : ''
      lines.push(`- ${lang.language}${level}${translate}`)
    }
    lines.push('')
  }

  if (interests.length) {
    lines.push('## Interests / الاهتمامات')
    lines.push('')
    lines.push(interests.join(' · '))
    lines.push('')
  }

  lines.push('---')
  lines.push('_Exported from المسار المهني_')
  return lines.join('\n').trim() + '\n'
}

export function buildCvPlainText(data: CvDocumentData): string {
  const vms = data.vmsProfile
  const name = displayNameOf(data)
  const role = latestRoleOf(data.workExperiences)
  const skills = splitCsv(vms?.skills)
  const interests = splitCsv(vms?.interests)
  const languages = languagesOf(data)
  const location = formatLocation({
    country: vms?.country,
    region: vms?.region,
    city: vms?.city,
  })
  const birthDate = formatBirthDate(vms?.dateOfBirth)
  const sex = sexLabel(vms?.sex)
  const cvUrl = data.profile.membership_number
    ? publicCvUrl(data.profile.membership_number)
    : ''

  const lines: string[] = []
  lines.push(name.toUpperCase())
  if (role) lines.push(role)
  lines.push('='.repeat(Math.min(48, Math.max(12, name.length))))
  const contact = [
    vms?.email,
    vms?.phoneNumber,
    location,
    sex !== '—' ? sex : null,
    birthDate ? `DOB: ${birthDate}` : null,
  ].filter(Boolean)
  if (contact.length) lines.push(contact.join(' | '))
  if (cvUrl) lines.push(cvUrl)
  lines.push('')

  if (data.profile.summary) {
    lines.push('PROFESSIONAL SUMMARY / النبذة المهنية')
    lines.push('-'.repeat(32))
    lines.push(data.profile.summary.trim())
    lines.push('')
  }

  if (data.workExperiences?.length) {
    lines.push('WORK EXPERIENCE / الخبرة العملية')
    lines.push('-'.repeat(32))
    for (const item of data.workExperiences) {
      lines.push(
        `${item.title || '—'}${item.company_name ? ` — ${item.company_name}` : ''}`,
      )
      lines.push(
        `${formatDateRange(item.start_date, item.end_date, item.is_current, 'Present')}${
          item.location ? ` | ${item.location}` : ''
        }`,
      )
      const body = item.responsibilities || item.description
      if (body) lines.push(body.trim())
      if (item.achievements) lines.push(item.achievements.trim())
      if (item.skills?.length) {
        lines.push(`Skills: ${item.skills.map((s) => s.name).join(', ')}`)
      }
      lines.push('')
    }
  }

  if (vms?.fieldOfStudy || vms?.school || vms?.educationLevel) {
    lines.push('EDUCATION / التعليم')
    lines.push('-'.repeat(32))
    lines.push(
      [vms?.fieldOfStudy, vms?.educationLevel, vms?.school, vms?.graduationYear]
        .filter(Boolean)
        .join(' · '),
    )
    lines.push('')
  }

  if (data.projects?.length) {
    lines.push('PROJECTS / المشاريع')
    lines.push('-'.repeat(32))
    for (const item of data.projects) {
      lines.push(item.name || '—')
      const meta = [item.role, item.company].filter(Boolean).join(' · ')
      if (meta) lines.push(meta)
      if (item.start_date || item.end_date || item.is_ongoing) {
        lines.push(formatDateRange(item.start_date, item.end_date, item.is_ongoing, 'Ongoing'))
      }
      if (item.responsibilities) lines.push(item.responsibilities.trim())
      if (item.outcomes) lines.push(item.outcomes.trim())
      if (item.skills?.length) {
        lines.push(`Skills: ${item.skills.map((s) => s.name).join(', ')}`)
      }
      lines.push('')
    }
  }

  if (skills.length) {
    lines.push('SKILLS / المهارات')
    lines.push('-'.repeat(32))
    lines.push(skills.join(', '))
    lines.push('')
  }

  if (languages.length) {
    lines.push('LANGUAGES / اللغات')
    lines.push('-'.repeat(32))
    for (const lang of languages) {
      const level = lang.proficiency != null ? ` (${lang.proficiency}/10)` : ''
      const translate = lang.openToTranslate ? ' [translator]' : ''
      lines.push(`- ${lang.language}${level}${translate}`)
    }
    lines.push('')
  }

  if (interests.length) {
    lines.push('INTERESTS / الاهتمامات')
    lines.push('-'.repeat(32))
    lines.push(interests.join(', '))
    lines.push('')
  }

  lines.push('Exported from المسار المهني')
  return lines.join('\n').trim() + '\n'
}

export async function copyText(text: string) {
  await navigator.clipboard.writeText(text)
}

export function downloadTextFile(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function cvExportBaseName(data: CvDocumentData) {
  return `CV-${safeFileName(displayNameOf(data))}`
}
