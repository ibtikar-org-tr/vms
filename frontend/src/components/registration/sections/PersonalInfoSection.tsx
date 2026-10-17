import { SectionCard } from '../SectionCard'
import { TextField } from '../TextField'
import { PhoneNumberField } from './personal-info-section/PhoneNumberField'
import { EmailField } from './personal-info-section/EmailField'
import { BirthDateField } from './personal-info-section/BirthDateField'
import { LocationDetailsComponent } from './personal-info-section/LocationDetailsComponent'
import type { RegistrationFormData } from '../../../types/registration'

type PersonalInfoSectionProps = {
  data: RegistrationFormData
  onFieldChange: (field: keyof RegistrationFormData, value: string) => void
  readOnlyFields?: Set<string>
  emailReadOnlyHint?: string
}

export function PersonalInfoSection({
  data,
  onFieldChange,
  readOnlyFields,
  emailReadOnlyHint,
}: PersonalInfoSectionProps) {

  return (
    <SectionCard
      title="التفاصيل الشخصية"
      subtitle="معلومات الهوية والاتصال المطلوبة."
      className="z-130"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="min-w-0 space-y-2 md:col-span-2" title={emailReadOnlyHint}>
          <EmailField
            id="email"
            label="البريد الإلكتروني"
            value={data.email}
            onChange={(value) => onFieldChange('email', value)}
            required
            readOnly={readOnlyFields?.has('email')}
            title={emailReadOnlyHint}
          />
          {readOnlyFields?.has('email') ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-6 text-amber-900 wrap-break-word" title={emailReadOnlyHint}>
              {emailReadOnlyHint
                ?? 'هذا الحقل غير قابل للتعديل. إذا كنت بحاجة لتغيير البريد الإلكتروني، يرجى التواصل مع الإدارة.'}
            </p>
          ) : (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-6 text-amber-900 wrap-break-word">
              تأكّد أنّك مسجّل من بريدك الالكتروني الأساسي لأننا سنتواصل معك عبر هذا الايميل
              <br />
              هام: هذا البريد الإلكتروني سوف تستخدمه في تسجيل الدخول لمنصّات التجمّع لاحقاً، وكذلك سيتمّ التواصل معك عبره، وسيكون من الصّعب تغيير لاحقاً
            </p>
          )}
        </div>
        <TextField
          id="ar-name"
          label="الاسم بالعربية"
          value={data.arName}
          onChange={(value) => onFieldChange('arName', value)}
          helperText="الاسم الكامل باللغة العربية"
          validationPattern={/^\s*[أ-يءآًٌٍَُِْ]+(?:\s*[أ-يءآًٌٍَُِْ]+)+\s*$/}
          validationMessage="يرجى كتابة الاسم الكامل باللغة العربيّة"
          required
        />
        <div className="min-w-0 text-left">
          <TextField
            id="en-name"
            label="Name Surname"
            value={data.enName}
            onChange={(value) => onFieldChange('enName', value)}
            inputDir="ltr"
            helperText="الاسم الكامل باللغة التركية أو الإنكليزية"
            validationPattern={/^\s*[a-zA-ZçÇğĞıİöÖşŞüÜ]+(?:\s+[a-zA-ZçÇğĞıİöÖşŞüÜ]+)+\s*$/}
            validationMessage="يرجى كتابة الاسم الكامل باللغة التركيّة/الإنكليزيّة"
            required
          />
        </div>
        <PhoneNumberField
          value={data.phoneNumber}
          onChange={(value) => onFieldChange('phoneNumber', value)}
          required
        />
        <div id="sex" className="flex flex-col gap-2 text-sm font-medium text-slate-700">
          <span>
            الجنس
            <span className="mr-1 font-bold text-red-600" aria-hidden="true">*</span>
          </span>
          <input
            tabIndex={-1}
            aria-hidden="true"
            value={data.sex}
            onChange={() => undefined}
            required
            className="sr-only"
          />
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onFieldChange('sex', 'male')}
              className={`flex h-11 items-center justify-center gap-2 rounded-xl border transition ${
                data.sex === 'male'
                  ? 'border-sky-400 bg-sky-50 text-sky-700'
                  : 'border-slate-300 bg-white text-slate-600 hover:border-sky-300'
              }`}
              aria-pressed={data.sex === 'male'}
              aria-label="ذكر"
            >
              <span className="rounded-full bg-sky-100 p-1 text-sky-700">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="7.5" r="3.2" />
                  <path d="M6 19.5c0-3.3 2.8-5.7 6-5.7s6 2.4 6 5.7" />
                  <path d="M12 13.8l-1.6 2.2 1.6 2.2 1.6-2.2-1.6-2.2z" />
                </svg>
              </span>
              <span>ذكر</span>
            </button>

            <button
              type="button"
              onClick={() => onFieldChange('sex', 'female')}
              className={`flex h-11 items-center justify-center gap-2 rounded-xl border transition ${
                data.sex === 'female'
                  ? 'border-pink-400 bg-pink-50 text-pink-700'
                  : 'border-slate-300 bg-white text-slate-600 hover:border-pink-300'
              }`}
              aria-pressed={data.sex === 'female'}
              aria-label="أنثى"
            >
              <span className="rounded-full bg-pink-100 p-1 text-pink-700">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="7.5" r="3.2" />
                  <path d="M7.3 8.3c.4-2.6 2.3-4.3 4.7-4.3s4.3 1.7 4.7 4.3" />
                  <path d="M6.2 19.5c.5-2.8 2.8-4.7 5.8-4.7s5.3 1.9 5.8 4.7" />
                  <path d="M9.2 14.8h5.6" />
                </svg>
              </span>
              <span>أنثى</span>
            </button>
          </div>
        </div>
        <BirthDateField
          id="dob"
          label="تاريخ الميلاد"
          value={data.dateOfBirth}
          onChange={(value) => onFieldChange('dateOfBirth', value)}
        />
        <LocationDetailsComponent
          data={data}
          onFieldChange={onFieldChange}
        />
      </div>
    </SectionCard>
  )
}
