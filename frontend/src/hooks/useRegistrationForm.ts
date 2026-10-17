import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  initialRegistrationFormData,
} from '../types/registration'
import type { FormFieldName, RegistrationFormData } from '../types/registration'
import { composeEmail, splitEmailParts } from '../utils/email'
import { validateRequiredFields } from '../utils/registrationValidation'

const DRAFT_STORAGE_KEY = 'registration-form-draft-v1'
const AUTOSAVE_STORAGE_KEY = 'registration-form-autosave-v1'
const SUBMISSION_STATUS_STORAGE_KEY = 'registration-form-submitted-v1'
const MEMBER_MS_BASE_URL = (import.meta.env.VITE_MEMBER_MS as string | undefined)?.trim()
const REGISTRATION_ENDPOINT = MEMBER_MS_BASE_URL
  ? `${MEMBER_MS_BASE_URL.replace(/\/+$/, '')}/api/registration`
  : '/ms/membership-app/api/registration'
const ALLOWED_SEX_VALUES = new Set(['male', 'female'])
const ALLOWED_BLOOD_TYPES = new Set(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])

export type RegistrationSuccessDetails = {
  message: string
  membershipNumber: string
  temporaryPassword?: string
  channel?: 'email' | 'telegram'
  signupToken?: string
}

type SubmissionStatus = RegistrationSuccessDetails

function normalizeDraftField(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  if (value === null || value === undefined) {
    return ''
  }

  return String(value)
}

function normalizeRegistrationDraft(rawDraft: unknown): RegistrationFormData {
  const normalizedDraft = { ...initialRegistrationFormData }

  if (!rawDraft || typeof rawDraft !== 'object' || Array.isArray(rawDraft)) {
    return normalizedDraft
  }

  const draftRecord = rawDraft as Record<string, unknown>
  for (const fieldName of Object.keys(initialRegistrationFormData) as FormFieldName[]) {
    normalizedDraft[fieldName] = normalizeDraftField(draftRecord[fieldName])
  }

  return normalizedDraft
}

function readSubmissionStatus(signupToken: string): SubmissionStatus | null {
  if (typeof window === 'undefined') {
    return null
  }

  const rawStatus = window.localStorage.getItem(SUBMISSION_STATUS_STORAGE_KEY)
  if (!rawStatus) {
    return null
  }

  try {
    const parsed = JSON.parse(rawStatus) as SubmissionStatus
    if (!parsed || typeof parsed.message !== 'string' || !parsed.message.trim() || parsed.signupToken !== signupToken) {
      return null
    }

    return parsed
  } catch {
    window.localStorage.removeItem(SUBMISSION_STATUS_STORAGE_KEY)
    return null
  }
}

function toOptionalTrimmedString(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function toOptionalStringArray(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed)) {
        const items = parsed.map((item) => String(item).trim()).filter(Boolean)
        return items.length > 0 ? items : undefined
      }

      if (parsed && typeof parsed === 'object') {
        const items = Object.keys(parsed as Record<string, unknown>)
          .map((item) => item.trim())
          .filter(Boolean)
        return items.length > 0 ? items : undefined
      }
    } catch {
      // fall through to CSV parsing
    }
  }

  const items = trimmed
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  return items.length > 0 ? items : undefined
}

type RegistrationApiErrorBody = {
  message?: string
  error?: string
  membershipNumber?: string
  temporaryPassword?: string
  channel?: 'email' | 'telegram'
  issues?: string[]
  details?: Array<{
    path?: Array<string | number>
    message?: string
  }>
}

function formatRegistrationApiError(responseBody: RegistrationApiErrorBody | null) {
  if (!responseBody) {
    return 'تعذّر إرسال الطلب. يرجى المحاولة مرة أخرى.'
  }

  if (responseBody.issues?.length) {
    return `${responseBody.error ?? 'يرجى تصحيح الحقول التالية قبل الإرسال.'}\n${responseBody.issues.join('\n')}`
  }

  if (responseBody.details?.length) {
    const detailMessages = responseBody.details
      .map((detail) => detail.message?.trim())
      .filter(Boolean)

    if (detailMessages.length > 0) {
      return `${responseBody.error ?? 'يرجى تصحيح الحقول التالية قبل الإرسال.'}\n${detailMessages.join('\n')}`
    }
  }

  if (responseBody.error?.trim()) {
    return responseBody.error.trim()
  }

  return 'تعذّر إرسال الطلب. يرجى المحاولة مرة أخرى.'
}

function toOptionalSocialMediaLinks(value: string) {
  if (!value.trim()) {
    return undefined
  }

  try {
    const parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return undefined
    }

    const links = Object.entries(parsed).reduce<Record<string, string>>((acc, [key, raw]) => {
      if (typeof raw === 'string') {
        const normalizedUrl = raw.trim()
        if (normalizedUrl) {
          acc[key] = normalizedUrl
        }
        return acc
      }

      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const label = 'label' in raw && typeof raw.label === 'string' ? raw.label.trim() : ''
        const url = 'url' in raw && typeof raw.url === 'string' ? raw.url.trim() : ''
        if (url) {
          const normalizedKey = label || key
          acc[normalizedKey] = url
        }
      }

      return acc
    }, {})

    return Object.keys(links).length > 0 ? links : undefined
  } catch {
    return undefined
  }
}

function toRegistrationPayload(formData: RegistrationFormData, signupToken: string) {
  const graduationYear = Number.parseInt(formData.graduationYear.trim(), 10)
  const normalizedSex = formData.sex.trim()
  const normalizedBloodType = formData.bloodType.trim().toUpperCase()

  const { localPart, domainPart } = splitEmailParts(formData.email)

  return {
    signupToken,
    email: composeEmail(localPart, domainPart).trim().toLowerCase(),
    enName: formData.enName.trim(),
    arName: formData.arName.trim(),
    phoneNumber: formData.phoneNumber.trim(),
    sex: ALLOWED_SEX_VALUES.has(normalizedSex) ? normalizedSex : undefined,
    dateOfBirth: toOptionalTrimmedString(formData.dateOfBirth),
    country: toOptionalTrimmedString(formData.country)?.toUpperCase(),
    region: toOptionalTrimmedString(formData.region),
    city: toOptionalTrimmedString(formData.city),
    address: toOptionalTrimmedString(formData.address),
    educationLevel: toOptionalTrimmedString(formData.educationLevel),
    school: toOptionalTrimmedString(formData.school),
    graduationYear: Number.isFinite(graduationYear) ? graduationYear : undefined,
    fieldOfStudy: toOptionalTrimmedString(formData.fieldOfStudy),
    bloodType: ALLOWED_BLOOD_TYPES.has(normalizedBloodType) ? normalizedBloodType : undefined,
    socialMediaLinks: toOptionalSocialMediaLinks(formData.socialMediaLinks),
    biography: undefined,
    interests: toOptionalStringArray(formData.interests),
    skills: toOptionalStringArray(formData.skills),
    languages: toOptionalStringArray(formData.languages),
    whereHeardAboutUs: toOptionalTrimmedString(formData.whereHeardAboutUs),
    motivationLetter: toOptionalTrimmedString(formData.motivationLetter),
    friendsOnPlatform: toOptionalStringArray(formData.friendsOnPlatform),
    interestInVolunteering: toOptionalTrimmedString(formData.interestInVolunteering),
    previousExperience: toOptionalTrimmedString(formData.previousExperience),
  }
}

export function useRegistrationForm(signupToken: string, lockedEmail?: string | null) {
  const initialSubmissionStatus = readSubmissionStatus(signupToken)
  const [formData, setFormData] = useState<RegistrationFormData>(initialRegistrationFormData)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccessMessage, setSubmitSuccessMessage] = useState<string | null>(initialSubmissionStatus?.message ?? null)
  const [registrationSuccess, setRegistrationSuccess] = useState<RegistrationSuccessDetails | null>(initialSubmissionStatus)
  const [hasSubmittedForm, setHasSubmittedForm] = useState<boolean>(Boolean(initialSubmissionStatus))
  const [isAutosaveEnabled, setIsAutosaveEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return true
    }

    const savedPreference = window.localStorage.getItem(AUTOSAVE_STORAGE_KEY)
    if (savedPreference === null) {
      return true
    }

    return savedPreference === 'true'
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !isAutosaveEnabled) {
      return
    }

    const savedDraft = window.localStorage.getItem(DRAFT_STORAGE_KEY)

    if (!savedDraft) {
      return
    }

    try {
      const parsedDraft = JSON.parse(savedDraft) as unknown
      const draft = normalizeRegistrationDraft(parsedDraft)
      if (lockedEmail) {
        draft.email = lockedEmail
      }
      setFormData(draft)
    } catch {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY)
    }
  }, [isAutosaveEnabled, lockedEmail])

  useEffect(() => {
    if (!lockedEmail) {
      return
    }

    setFormData((current) => (current.email === lockedEmail ? current : { ...current, email: lockedEmail }))
  }, [lockedEmail])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(AUTOSAVE_STORAGE_KEY, String(isAutosaveEnabled))

    if (!isAutosaveEnabled) {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY)
      return
    }

    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(formData))
  }, [formData, isAutosaveEnabled])

  const updateField = (field: FormFieldName, value: string) => {
    if (field === 'email' && lockedEmail) {
      return
    }

    setFormData((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setSubmitError(null)
    setSubmitSuccessMessage(null)

    const requiredFieldError = validateRequiredFields(formData)
    if (requiredFieldError) {
      setSubmitError(requiredFieldError)
      return
    }

    setIsSubmitting(true)

    try {
      const payload = toRegistrationPayload(
        lockedEmail ? { ...formData, email: lockedEmail } : formData,
        signupToken,
      )
      const response = await fetch(REGISTRATION_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const responseBody = (await response.json().catch(() => null)) as RegistrationApiErrorBody | null

      if (!response.ok) {
        setSubmitError(formatRegistrationApiError(responseBody))
        return
      }

      const successMessage = responseBody?.message ?? 'تم إرسال طلب التسجيل بنجاح.'
      const successDetails: RegistrationSuccessDetails = {
        message: successMessage,
        membershipNumber: responseBody?.membershipNumber ?? '',
        temporaryPassword: responseBody?.temporaryPassword,
        channel: responseBody?.channel,
      }

      setSubmitSuccessMessage(successMessage)
      setRegistrationSuccess(successDetails)
      setHasSubmittedForm(true)
      setFormData(initialRegistrationFormData)

      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY)
        window.localStorage.setItem(
          SUBMISSION_STATUS_STORAGE_KEY,
          JSON.stringify({
            message: successDetails.message,
            membershipNumber: successDetails.membershipNumber,
            channel: successDetails.channel,
            signupToken,
          }),
        )
      }
    } catch {
      setSubmitError('تعذّر الاتصال بالخادم. تحقّق من الشبكة ثم حاول مجددًا.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleAutosave = () => {
    setIsAutosaveEnabled((current) => !current)
  }

  const resetSubmissionStatus = () => {
    setHasSubmittedForm(false)
    setSubmitSuccessMessage(null)
    setRegistrationSuccess(null)

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(SUBMISSION_STATUS_STORAGE_KEY)
    }
  }

  return {
    formData,
    isSubmitting,
    submitError,
    submitSuccessMessage,
    registrationSuccess,
    hasSubmittedForm,
    isAutosaveEnabled,
    updateField,
    handleSubmit,
    toggleAutosave,
    resetSubmissionStatus,
  }
}
