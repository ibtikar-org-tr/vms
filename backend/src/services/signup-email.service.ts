import { RegistrationEmailError } from '../errors/registration.errors'
import type { AppBindings } from '../types/bindings'
import { isAppEmailConfigured, sendAppEmail } from './app-email.service'

async function sendPlainEmail(
  bindings: AppBindings,
  params: { to: string; subject: string; text: string },
): Promise<void> {
  if (!isAppEmailConfigured(bindings)) {
    throw new RegistrationEmailError(
      'Email configuration is incomplete. Please configure AUTHDEEP_API_TOKEN or SMTP. يرجى التواصل مع الأدمين وإخباره',
    )
  }

  try {
    await sendAppEmail(bindings, params)
  } catch (error) {
    if (error instanceof RegistrationEmailError) {
      throw error
    }

    throw new RegistrationEmailError('Unable to send email at this time. يرجى التواصل مع الأدمين وإخباره', {
      cause: error,
    })
  }
}

export async function sendSignupLinkEmail(bindings: AppBindings, recipientEmail: string, signupUrl: string): Promise<void> {
  await sendPlainEmail(bindings, {
    to: recipientEmail,
    subject: 'رابط الانتساب إلى تجمّع إبتكار',
    text:
      'لإكمال الانتساب إلى تجمّع إبتكار افتح الرابط التالي. الرابط صالح لمدة 24 ساعة ويُستخدم مرة واحدة.\n\n'
      + `${signupUrl}\n\n`
      + 'إذا لم تطلب هذا الرابط يمكنك تجاهل الرسالة.',
  })
}

export async function sendEmailVerificationEmail(
  bindings: AppBindings,
  recipientEmail: string,
  verificationUrl: string,
): Promise<void> {
  await sendPlainEmail(bindings, {
    to: recipientEmail,
    subject: 'تأكيد البريد الإلكتروني — تجمّع إبتكار',
    text:
      'لتأكيد بريدك الإلكتروني في عضوية تجمّع إبتكار افتح الرابط التالي. الرابط صالح لمدة 7 أيام.\n\n'
      + `${verificationUrl}\n\n`
      + 'يمكنك استخدام العضوية قبل تأكيد البريد. سيبقى البريد غير مؤكد في ملفك حتى تضغط الرابط.',
  })
}

export async function sendDuplicateSignupAlertEmail(bindings: AppBindings, recipientEmail: string): Promise<void> {
  const recoveryUrl = `${(bindings.FRONTEND_BASE_URL || 'https://ibtikar.tr').replace(/\/+$/, '')}/iforgot`
  await sendPlainEmail(bindings, {
    to: recipientEmail,
    subject: 'تنبيه: محاولة انتساب باستخدام بريدك — تجمّع إبتكار',
    text:
      'حاول شخص إنشاء عضوية جديدة عبر تيليغرام باستخدام بريدك الإلكتروني. لم يتم إنشاء حساب جديد.\n\n'
      + 'إذا لم تكن أنت، يمكنك تجاهل هذه الرسالة.\n'
      + `إذا نسيت بيانات عضويتك يمكنك استرجاعها من: ${recoveryUrl}`,
  })
}
