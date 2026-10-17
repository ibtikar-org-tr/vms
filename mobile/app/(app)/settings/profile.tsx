import { useFocusEffect } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { fetchProfile, resendEmailVerification, updateProfile } from '@/src/api/profile'
import { useAuth } from '@/src/auth/AuthContext'
import { ErrorBanner, ProgressBar, SectionTitle } from '@/src/components/ui'
import { colors } from '@/src/theme/colors'
import type { MemberProfile } from '@/src/types/profile'
import { calculateProfileCompletion } from '@/src/utils/profile'

type EditableField =
  | 'enName'
  | 'arName'
  | 'phoneNumber'
  | 'sex'
  | 'dateOfBirth'
  | 'country'
  | 'region'
  | 'city'
  | 'address'
  | 'educationLevel'
  | 'school'
  | 'fieldOfStudy'
  | 'graduationYear'
  | 'skills'
  | 'interests'
  | 'languages'
  | 'bloodType'
  | 'biography'

const EDITABLE_FIELDS: Array<{ key: EditableField; label: string; multiline?: boolean }> = [
  { key: 'enName', label: 'الاسم بالإنكليزية' },
  { key: 'arName', label: 'الاسم بالعربية' },
  { key: 'phoneNumber', label: 'رقم الهاتف' },
  { key: 'sex', label: 'الجنس (male/female)' },
  { key: 'dateOfBirth', label: 'تاريخ الميلاد (YYYY-MM-DD)' },
  { key: 'country', label: 'الدولة' },
  { key: 'region', label: 'المنطقة' },
  { key: 'city', label: 'المدينة' },
  { key: 'address', label: 'العنوان', multiline: true },
  { key: 'educationLevel', label: 'المستوى التعليمي' },
  { key: 'school', label: 'المدرسة / الجامعة' },
  { key: 'fieldOfStudy', label: 'مجال الدراسة' },
  { key: 'graduationYear', label: 'سنة التخرج' },
  { key: 'skills', label: 'المهارات', multiline: true },
  { key: 'interests', label: 'الاهتمامات', multiline: true },
  { key: 'languages', label: 'اللغات', multiline: true },
  { key: 'bloodType', label: 'زمرة الدم' },
  { key: 'biography', label: 'نبذة', multiline: true },
]

function profileToDraft(profile: MemberProfile): Record<EditableField, string> {
  return {
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
    fieldOfStudy: profile.fieldOfStudy ?? '',
    graduationYear: profile.graduationYear?.toString() ?? '',
    skills: profile.skills ?? '',
    interests: profile.interests ?? '',
    languages: profile.languages ?? '',
    bloodType: profile.bloodType ?? '',
    biography: profile.biography ?? '',
  }
}

export default function ProfileScreen() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [draft, setDraft] = useState<Record<EditableField, string> | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null)
  const [isResendingVerification, setIsResendingVerification] = useState(false)

  const load = useCallback(async () => {
    if (!user?.membershipNumber) {
      setError('يجب تسجيل الدخول أولاً.')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const payload = await fetchProfile(user.membershipNumber)
      setProfile(payload.profile)
      setDraft(profileToDraft(payload.profile))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذر تحميل الملف الشخصي.')
    } finally {
      setIsLoading(false)
    }
  }, [user?.membershipNumber])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  const readOnlyRows = useMemo(() => {
    if (!profile) return []
    return [
      {
        label: 'البريد الإلكتروني',
        value: profile.emailVerified ? profile.email : `${profile.email} — غير مؤكد`,
      },
      { label: 'رقم العضوية', value: profile.membershipNumber },
      { label: 'تيليغرام', value: profile.telegramUsername || profile.telegramId || '-' },
      { label: 'الدور', value: profile.role },
    ]
  }, [profile])

  const profileCompletion = useMemo(() => calculateProfileCompletion(profile), [profile])

  const handleSave = async () => {
    if (!user?.membershipNumber || !draft) return

    setIsSaving(true)
    setSaveError(null)

    try {
      const payload = {
        enName: draft.enName,
        arName: draft.arName,
        phoneNumber: draft.phoneNumber,
        sex: draft.sex,
        dateOfBirth: draft.dateOfBirth,
        country: draft.country,
        region: draft.region,
        city: draft.city,
        address: draft.address,
        educationLevel: draft.educationLevel,
        school: draft.school,
        fieldOfStudy: draft.fieldOfStudy,
        graduationYear: draft.graduationYear
          ? Number.parseInt(draft.graduationYear, 10)
          : undefined,
        skills: draft.skills,
        interests: draft.interests,
        languages: draft.languages,
        bloodType: draft.bloodType,
        biography: draft.biography,
      }

      const response = await updateProfile(user.membershipNumber, payload)
      setProfile(response.profile)
      setDraft(profileToDraft(response.profile))
      setIsEditing(false)
    } catch (requestError) {
      setSaveError(requestError instanceof Error ? requestError.message : 'تعذر حفظ الملف الشخصي.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <SectionTitle title="الملف الشخصي" subtitle="بيانات عضويتك في تجمّع إبتكار." />

      {isLoading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} /> : null}
      {error ? <ErrorBanner message={error} /> : null}

      {profile && draft ? (
        <>
          {!isEditing ? (
            <View style={styles.completionCard}>
              <ProgressBar value={profileCompletion} label="إكمال الملف الشخصي" />
            </View>
          ) : null}

          <View style={styles.actions}>
            {isEditing ? (
              <>
                <Pressable
                  style={[styles.button, styles.saveButton, isSaving && styles.disabled]}
                  disabled={isSaving}
                  onPress={() => void handleSave()}
                >
                  <Text style={styles.buttonText}>{isSaving ? 'جارٍ الحفظ...' : 'حفظ'}</Text>
                </Pressable>
                <Pressable
                  style={[styles.button, styles.cancelButton]}
                  disabled={isSaving}
                  onPress={() => {
                    setDraft(profileToDraft(profile))
                    setIsEditing(false)
                    setSaveError(null)
                  }}
                >
                  <Text style={styles.cancelText}>إلغاء</Text>
                </Pressable>
              </>
            ) : (
              <Pressable style={[styles.button, styles.saveButton]} onPress={() => setIsEditing(true)}>
                <Text style={styles.buttonText}>تعديل</Text>
              </Pressable>
            )}
          </View>

          {saveError ? <ErrorBanner message={saveError} /> : null}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>بيانات ثابتة</Text>
            {readOnlyRows.map((row) => (
              <View key={row.label} style={styles.field}>
                <Text style={styles.label}>{row.label}</Text>
                <Text style={styles.value}>{row.value}</Text>
              </View>
            ))}
            {profile.emailVerified ? null : (
              <View style={styles.field}>
                <Pressable
                  disabled={isResendingVerification}
                  onPress={() => {
                    setVerificationMessage(null)
                    setIsResendingVerification(true)
                    void resendEmailVerification(profile.membershipNumber)
                      .then((response) => setVerificationMessage(response.message))
                      .catch((requestError: unknown) => {
                        setVerificationMessage(
                          requestError instanceof Error ? requestError.message : 'تعذر إرسال رابط التأكيد.',
                        )
                      })
                      .finally(() => setIsResendingVerification(false))
                  }}
                >
                  <Text style={styles.link}>
                    {isResendingVerification ? 'جارٍ الإرسال...' : 'إعادة إرسال رابط التأكيد'}
                  </Text>
                </Pressable>
                {verificationMessage ? <Text style={styles.value}>{verificationMessage}</Text> : null}
              </View>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>بيانات قابلة للتعديل</Text>
            {EDITABLE_FIELDS.map((field) => (
              <View key={field.key} style={styles.field}>
                <Text style={styles.label}>{field.label}</Text>
                {isEditing ? (
                  <TextInput
                    value={draft[field.key]}
                    onChangeText={(value) => setDraft((prev) => (prev ? { ...prev, [field.key]: value } : prev))}
                    style={[styles.input, field.multiline && styles.multiline]}
                    multiline={field.multiline}
                    textAlign="right"
                    placeholderTextColor={colors.textMuted}
                  />
                ) : (
                  <Text style={styles.value}>{draft[field.key] || '-'}</Text>
                )}
              </View>
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: 16, gap: 12, paddingBottom: 40 },
  completionCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  actions: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  button: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  cancelButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  disabled: { opacity: 0.7 },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
  cancelText: {
    color: colors.text,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
  },
  cardTitle: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 15,
    textAlign: 'right',
  },
  field: { gap: 4 },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
  },
  value: {
    color: colors.text,
    fontSize: 15,
    textAlign: 'right',
    lineHeight: 22,
  },
  link: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    backgroundColor: '#f8fafc',
    fontSize: 15,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
})
