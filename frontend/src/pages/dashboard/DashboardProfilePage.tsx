import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { fetchProfile, resendEmailVerification, updateProfile } from '../../api/vms'
import { ChangePasswordCard } from '../../components/dashboard/ChangePasswordCard'
import type { MemberProfile } from '../../types/profile'
import type { RegistrationFormData } from '../../types/registration'
import { getStoredUser } from '../../utils/auth'
import { formatDateEnCA } from '../../utils/date-format'
import {
  Edit2,
  Save,
  X,
  User,
  Mail,
  Phone,
  MapPin,
  GraduationCap,
  Award,
  Globe,
  Heart,
  Calendar,
  Hash,
  Shield,
  Languages,
} from 'lucide-react'

const PersonalInfoSection = lazy(() =>
  import('../../components/registration/sections/PersonalInfoSection').then((module) => ({ default: module.PersonalInfoSection })),
)
const EducationSection = lazy(() =>
  import('../../components/registration/sections/EducationSection').then((module) => ({ default: module.EducationSection })),
)
const ProfileSection = lazy(() =>
  import('../../components/registration/sections/ProfileSection').then((module) => ({ default: module.ProfileSection })),
)

const READ_ONLY_FIELDS = new Set(['membershipNumber', 'email', 'telegramId', 'telegramUsername'])

function profileToFormData(profile: MemberProfile): RegistrationFormData {
  return {
    email: profile.email,
    enName: profile.enName ?? '',
    arName: profile.arName ?? '',
    phoneNumber: profile.phoneNumber ?? '',
    sex: profile.sex ?? '',
    dateOfBirth: profile.dateOfBirth ?? '',
    country: profile.country ?? '',
    region: profile.region ?? '',
    city: profile.city ?? '',
    address: profile.address ?? '',
    educationLevel: profile.educationLevel ?? '',
    school: profile.school ?? '',
    graduationYear: profile.graduationYear?.toString() ?? '',
    fieldOfStudy: profile.fieldOfStudy ?? '',
    bloodType: profile.bloodType ?? '',
    socialMediaLinks: profile.socialMediaLinks ?? '',
    interests: profile.interests ?? '',
    skills: profile.skills ?? '',
    languages: profile.languages ?? '',
    whereHeardAboutUs: '',
    motivationLetter: '',
    friendsOnPlatform: '',
    interestInVolunteering: '',
    previousExperience: '',
    bylawsAcknowledgement: '',
  }
}

export function DashboardProfilePage() {
  const membershipNumber = getStoredUser()?.membershipNumber ?? null
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [verificationMessage, setVerificationMessage] = useState('')
  const [isResendingVerification, setIsResendingVerification] = useState(false)
  const [formData, setFormData] = useState<RegistrationFormData | null>(null)

  useEffect(() => {
    if (!membershipNumber) {
      setHasError(true)
      setIsLoading(false)
      return
    }

    const currentMembershipNumber = membershipNumber

    setIsLoading(true)

    const controller = new AbortController()

    async function loadProfile() {
      try {
        const payload = await fetchProfile(currentMembershipNumber)

        if (!controller.signal.aborted) {
          setProfile(payload.profile)
          setFormData(profileToFormData(payload.profile))
          setHasError(false)
        }
      } catch {
        if (!controller.signal.aborted) {
          setHasError(true)
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    loadProfile()

    return () => {
      controller.abort()
    }
  }, [membershipNumber])

  const handleEditClick = () => {
    setIsEditMode(true)
    setSaveError('')
  }

  const handleCancel = () => {
    setIsEditMode(false)
    setSaveError('')
    if (profile && formData) {
      setFormData(profileToFormData(profile))
    }
  }

  const handleFieldChange = (field: keyof RegistrationFormData, value: string) => {
    if (READ_ONLY_FIELDS.has(field)) {
      return
    }
    setFormData((prev) => {
      if (!prev) return null
      return { ...prev, [field]: value }
    })
  }

  const handleSave = async () => {
    if (!membershipNumber || !formData) {
      return
    }

    setIsSaving(true)
    setSaveError('')

    try {
      const updatePayload = {
        enName: formData.enName,
        arName: formData.arName,
        phoneNumber: formData.phoneNumber,
        sex: formData.sex,
        dateOfBirth: formData.dateOfBirth,
        country: formData.country,
        region: formData.region,
        city: formData.city,
        address: formData.address,
        educationLevel: formData.educationLevel,
        school: formData.school,
        graduationYear: formData.graduationYear ? Number.parseInt(formData.graduationYear, 10) : undefined,
        fieldOfStudy: formData.fieldOfStudy,
        bloodType: formData.bloodType,
        socialMediaLinks: formData.socialMediaLinks,
        interests: formData.interests,
        skills: formData.skills,
        languages: formData.languages,
      }

      const response = await updateProfile(membershipNumber, updatePayload)
      setProfile(response.profile)
      setFormData(profileToFormData(response.profile))
      setIsEditMode(false)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'حدث خطأ أثناء حفظ البيانات')
    } finally {
      setIsSaving(false)
    }
  }

  const profileSections = useMemo(() => {
    const fallback = '-'
    const sexLabel = profile?.sex === 'male' ? 'ذكر' : profile?.sex === 'female' ? 'أنثى' : (profile?.sex ?? fallback)

    return [
      {
        title: 'المعلومات الأساسية',
        icon: User,
        items: [
          { label: 'الاسم بالإنكليزية', value: profile?.enName ?? fallback, field: 'enName', icon: User },
          { label: 'الاسم بالعربية', value: profile?.arName ?? fallback, field: 'arName', icon: User },
          {
            label: 'البريد الإلكتروني',
            value: profile?.email
              ? `${profile.email}${profile.emailVerified ? '' : ' — غير مؤكد'}`
              : fallback,
            field: 'email',
            icon: Mail,
          },
          { label: 'رقم العضوية', value: profile?.membershipNumber ?? fallback, field: 'membershipNumber', icon: Hash },
          { label: 'رقم الهاتف', value: profile?.phoneNumber ?? fallback, field: 'phoneNumber', icon: Phone },
          { label: 'الجنس', value: sexLabel, field: 'sex', icon: Shield },
          { label: 'تاريخ الميلاد', value: profile?.dateOfBirth ? formatDateEnCA(profile.dateOfBirth) : fallback, field: 'dateOfBirth', icon: Calendar },
        ]
      },
      {
        title: 'العنوان والموقع',
        icon: MapPin,
        items: [
          { label: 'الدولة', value: profile?.country ?? fallback, field: 'country', icon: Globe },
          { label: 'المنطقة', value: profile?.region ?? fallback, field: 'region', icon: MapPin },
          { label: 'المدينة', value: profile?.city ?? fallback, field: 'city', icon: MapPin },
          { label: 'العنوان', value: profile?.address ?? fallback, field: 'address', icon: MapPin },
        ]
      },
      {
        title: 'التعليم',
        icon: GraduationCap,
        items: [
          { label: 'المستوى التعليمي', value: profile?.educationLevel ?? fallback, field: 'educationLevel', icon: GraduationCap },
          { label: 'المدرسة / الجامعة', value: profile?.school ?? fallback, field: 'school', icon: GraduationCap },
          { label: 'سنة التخرج', value: profile?.graduationYear ? String(profile.graduationYear) : fallback, field: 'graduationYear', icon: Calendar },
          { label: 'مجال الدراسة', value: profile?.fieldOfStudy ?? fallback, field: 'fieldOfStudy', icon: Award },
        ]
      },
      {
        title: 'المهارات والاهتمامات',
        icon: Award,
        items: [
          { label: 'المهارات', value: profile?.skills ?? fallback, field: 'skills', icon: Award },
          { label: 'الاهتمامات', value: profile?.interests ?? fallback, field: 'interests', icon: Heart },
          { label: 'اللغات', value: profile?.languages ?? fallback, field: 'languages', icon: Languages },
          { label: 'زمرة الدم', value: profile?.bloodType ?? fallback, field: 'bloodType', icon: Heart },
        ]
      }
    ]
  }, [profile])

  const profileCompletion = useMemo(() => {
    if (!profile) return 0

    const fields = [
      profile.enName, profile.arName, profile.phoneNumber, profile.sex,
      profile.dateOfBirth, profile.country, profile.region, profile.city,
      profile.educationLevel, profile.school, profile.graduationYear,
      profile.fieldOfStudy, profile.skills, profile.interests, profile.languages
    ]

    const filledFields = fields.filter(field => {
      if (field === undefined || field === null) return false
      return typeof field === 'string' ? field.trim() !== '' : true
    }).length
    return Math.round((filledFields / fields.length) * 100)
  }, [profile])

  if (isLoading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="animate-pulse space-y-6">
          {/* Header skeleton */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-slate-200 rounded-full"></div>
            <div className="space-y-2">
              <div className="h-6 bg-slate-200 rounded w-48"></div>
              <div className="h-4 bg-slate-200 rounded w-32"></div>
              <div className="h-4 bg-slate-200 rounded w-40"></div>
            </div>
          </div>

          {/* Content skeleton */}
          <div className="space-y-8">
            {[1, 2, 3, 4].map((section) => (
              <div key={section} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-200 rounded-lg"></div>
                  <div className="h-6 bg-slate-200 rounded w-32"></div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {[1, 2, 3, 4].map((item) => (
                    <div key={item} className="h-16 bg-slate-100 rounded-lg"></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (hasError) {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-red-100 rounded-full">
            <X className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-red-900">خطأ في تحميل البيانات</h3>
            <p className="text-sm text-red-700">تعذر تحميل بيانات الملف الشخصي. يرجى المحاولة مرة أخرى.</p>
          </div>
        </div>
      </section>
    )
  }

  if (!profile || !formData) {
    return null
  }

  return (
    <div className="space-y-6">
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
            <User className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">الملف الشخصي</h2>
            <p className="text-sm text-slate-600">
              {isEditMode ? 'تعديل البيانات الشخصية' : 'إدارة ومراجعة معلوماتك الشخصية'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {!isEditMode && (
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900">{profileCompletion}%</div>
              <div className="text-xs text-slate-500">إكمال الملف</div>
              <div className="w-16 h-2 bg-slate-200 rounded-full mt-1">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-300"
                  style={{ width: `${profileCompletion}%` }}
                ></div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {!isEditMode ? (
              <button
                onClick={handleEditClick}
                className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100 hover:shadow-sm"
              >
                <Edit2 className="h-4 w-4" />
                تعديل الملف
              </button>
            ) : (
              <>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 transition hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-sm"
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-sm"
                >
                  <X className="h-4 w-4" />
                  إلغاء
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {saveError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{saveError}</p>
        </div>
      )}

      {!isEditMode ? (
        <div className="space-y-8">
          {/* Profile Header */}
          <div className="flex items-center gap-4 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              {profile?.enName?.charAt(0)?.toUpperCase() || profile?.arName?.charAt(0) || 'U'}
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">
                {profile?.enName || profile?.arName || 'المستخدم'}
              </h3>
              <p className="text-sm text-slate-600">
                رقم العضوية: {profile?.membershipNumber}
              </p>
              <p className="text-sm text-slate-500">
                {profile?.email}
                {profile && !profile.emailVerified ? (
                  <span className="mr-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">
                    غير مؤكد
                  </span>
                ) : null}
              </p>
              {profile && !profile.emailVerified ? (
                <div className="mt-2">
                  <button
                    type="button"
                    disabled={isResendingVerification}
                    onClick={() => {
                      setVerificationMessage('')
                      setIsResendingVerification(true)
                      void resendEmailVerification(profile.membershipNumber)
                        .then((response) => setVerificationMessage(response.message))
                        .catch((error: unknown) => {
                          setVerificationMessage(error instanceof Error ? error.message : 'تعذّر إرسال رابط التأكيد.')
                        })
                        .finally(() => setIsResendingVerification(false))
                    }}
                    className="text-xs font-bold text-cyan-800 underline disabled:opacity-60"
                  >
                    {isResendingVerification ? 'جارٍ الإرسال...' : 'إعادة إرسال رابط التأكيد'}
                  </button>
                  {verificationMessage ? (
                    <p className="mt-1 text-xs text-slate-600">{verificationMessage}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {/* Profile Sections */}
          {profileSections.map((section) => {
            const SectionIcon = section.icon
            return (
              <div key={section.title} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <SectionIcon className="h-5 w-5 text-slate-600" />
                  </div>
                  <h4 className="text-lg font-semibold text-slate-900">{section.title}</h4>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {section.items.map((item) => {
                    const ItemIcon = item.icon
                    return (
                      <div
                        key={item.label}
                        className={`rounded-lg border px-4 py-3 transition-colors ${
                          READ_ONLY_FIELDS.has(item.field as any)
                            ? 'border-slate-200 bg-slate-50/50 hover:bg-slate-50/70'
                            : 'border-slate-200 bg-white hover:bg-slate-50/70'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <ItemIcon className="h-4 w-4 text-slate-400" />
                          <p className="text-xs font-medium text-slate-500">{item.label}</p>
                        </div>
                        <p className="text-sm font-semibold text-slate-800 leading-relaxed">{item.value}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Edit Mode Header */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-3">
              <Edit2 className="h-5 w-5 text-amber-600" />
              <div>
                <h4 className="font-medium text-amber-900">وضع التعديل</h4>
                <p className="text-sm text-amber-700">يمكنك تعديل معلوماتك الشخصية. الحقول ذات الخلفية الرمادية غير قابلة للتعديل.</p>
              </div>
            </div>
          </div>

          {/* Form Sections */}
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <h4 className="text-lg font-semibold text-slate-900">المعلومات الشخصية</h4>
              </div>
              <Suspense fallback={<div className="h-32 animate-pulse rounded-2xl bg-slate-100" />}>
                <PersonalInfoSection data={formData} onFieldChange={handleFieldChange} readOnlyFields={READ_ONLY_FIELDS} />
              </Suspense>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <GraduationCap className="h-5 w-5 text-green-600" />
                </div>
                <h4 className="text-lg font-semibold text-slate-900">التعليم</h4>
              </div>
              <Suspense fallback={<div className="h-32 animate-pulse rounded-2xl bg-slate-100" />}>
                <EducationSection data={formData} onFieldChange={handleFieldChange} />
              </Suspense>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Award className="h-5 w-5 text-purple-600" />
                </div>
                <h4 className="text-lg font-semibold text-slate-900">الملف الشخصي والمهارات</h4>
              </div>
              <Suspense fallback={<div className="h-32 animate-pulse rounded-2xl bg-slate-100" />}>
                <ProfileSection data={formData} onFieldChange={handleFieldChange} />
              </Suspense>
            </div>
          </div>
        </div>
      )}
    </section>
    <ChangePasswordCard />
    </div>
  )
}