import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import type { ZodIssue } from 'zod'
import { EmailAlreadyExistsError, MembershipNumberAllocationError, PhoneNumberAlreadyExistsError, RegistrationEmailError } from '../errors/registration.errors'
import { registrationSchema } from '../schemas/registration'
import { registerUser, TelegramIdAlreadyUsedError } from '../services/registration.service'
import { SignupTokenError, verifySignupToken } from '../services/signup-link.service'
import type { AppBindings } from '../types/bindings'

export const registrationRoute = new Hono<{ Bindings: AppBindings }>()

const REGISTRATION_FIELD_LABELS: Record<string, string> = {
  signupToken: 'رابط الانتساب',
  email: 'البريد الإلكتروني',
  enName: 'الاسم بالإنكليزية أو التركية',
  arName: 'الاسم بالعربية',
  phoneNumber: 'رقم الهاتف',
  sex: 'الجنس',
  dateOfBirth: 'تاريخ الميلاد',
  country: 'الدولة',
  region: 'الولاية / المحافظة',
  city: 'المدينة',
  address: 'العنوان',
  educationLevel: 'مستوى التعليم',
  school: 'المدرسة أو الجامعة',
  fieldOfStudy: 'الفرع الدراسي',
  graduationYear: 'سنة التخرج',
  bloodType: 'فصيلة الدم',
  socialMediaLinks: 'روابط وسائل التواصل',
  biography: 'السيرة الذاتية',
  interests: 'الاهتمامات',
  skills: 'المهارات',
  languages: 'اللغات',
  whereHeardAboutUs: 'كيف سمعت عنا',
  motivationLetter: 'رسالة الدافع',
  friendsOnPlatform: 'الأصدقاء على المنصة',
  interestInVolunteering: 'الاهتمام بالتطوع',
  previousExperience: 'الخبرة السابقة',
}

function formatValidationIssues(issues: ZodIssue[]) {
  return issues.map((issue) => {
    const field = issue.path[0]
    const label = typeof field === 'string' ? REGISTRATION_FIELD_LABELS[field] ?? field : 'حقل'
    return `${label}: ${issue.message}`
  })
}

function mapUnexpectedRegistrationError(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes('UNIQUE constraint failed: user_skills')) {
      return 'تعذّر حفظ المهارات أو الاهتمامات بسبب تكرار غير متوقع. تأكّد من عدم إدخال نفس العنصر في المهارات والاهتمامات معاً، ثم حاول مرة أخرى.'
    }

    if (error.message.includes('UNIQUE constraint failed: users.membership_number')) {
      return 'تعذّر إنشاء رقم عضوية جديد حالياً. يرجى المحاولة مرة أخرى بعد قليل.'
    }

    if (error.message.includes('UNIQUE constraint failed: skills.name')) {
      return 'تعذّر حفظ إحدى المهارات بسبب تعارض في الاسم. جرّب اختيار المهارة من القائمة بدل كتابتها يدوياً.'
    }
  }

  return 'تعذّر إكمال التسجيل. تحقّق من البيانات المدخلة ثم حاول مرة أخرى، أو تواصل مع الدعم الفني عبر @ibtikar.org.tr على تيليغرام.'
}

registrationRoute.post(
  '/registration',
  zValidator('json', registrationSchema, (result, c) => {
    if (!result.success) {
      const issues = formatValidationIssues(result.error.issues)

      return c.json(
        {
          error: 'يرجى تصحيح الحقول التالية قبل الإرسال.',
          details: result.error.issues.map((issue) => ({
            path: issue.path,
            message: issue.message,
          })),
          issues,
        },
        400,
      )
    }
  }),
  async (c) => {
    try {
      const payload = c.req.valid('json')
      const intent = await verifySignupToken(c.env, payload.signupToken)
      const result = await registerUser(c.env, payload, intent)
      const message = result.channel === 'email'
        ? 'تمّ إكمال التسجيل. احتفظ برقم العضوية وكلمة المرور، ثم فعّل بوت تيليغرام قبل تسجيل الدخول. أرسلنا نفس البيانات إلى بريدك.'
        : 'تمّ إكمال التسجيل. يمكنك تسجيل الدخول الآن. أرسلنا رقم العضوية وكلمة المرور على تيليغرام، وبريدك يبقى غير مؤكد حتى تضغط رابط التأكيد.'

      return c.json(
        {
          message,
          membershipNumber: result.membershipNumber,
          temporaryPassword: result.temporaryPassword,
          channel: result.channel,
        },
        201,
      )
    } catch (error) {
      if (error instanceof SignupTokenError) {
        return c.json({ error: error.message }, 400)
      }

      if (error instanceof EmailAlreadyExistsError) {
        return c.json({ error: error.message, code: 'EMAIL_ALREADY_REGISTERED' }, 409)
      }

      if (error instanceof TelegramIdAlreadyUsedError) {
        return c.json({ error: error.message }, 409)
      }

      if (error instanceof PhoneNumberAlreadyExistsError) {
        return c.json({ error: error.message }, 409)
      }

      if (error instanceof MembershipNumberAllocationError) {
        return c.json({ error: error.message }, 503)
      }

      if (error instanceof RegistrationEmailError) {
        return c.json({ error: error.message }, 503)
      }

      console.error('Registration failed with unexpected error', error)

      return c.json({ error: mapUnexpectedRegistrationError(error) }, 500)
    }
  },
)
