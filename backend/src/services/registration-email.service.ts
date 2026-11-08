import type { AppBindings } from '../types/bindings'
import { RegistrationEmailError } from '../errors/registration.errors'
import {
  buildRegistrationCredentialsEmailHtml,
  buildRegistrationCredentialsEmailText,
  resolveRegistrationEmailUrls,
} from '../templates/registration-credentials-email'
import { isAppEmailConfigured, sendAppEmail } from './app-email.service'

interface SendRegistrationCredentialsEmailParams {
  recipientEmail: string
  membershipNumber: string
  temporaryPassword: string
}

export async function sendRegistrationCredentialsEmail(
  bindings: AppBindings,
  params: SendRegistrationCredentialsEmailParams,
): Promise<void> {
  if (!isAppEmailConfigured(bindings)) {
    throw new RegistrationEmailError(
      'Email configuration is incomplete. Please configure AUTHDEEP_API_TOKEN or SMTP. يرجى التواصل مع الأدمين وإخباره',
    )
  }

  const urls = resolveRegistrationEmailUrls(bindings.FRONTEND_BASE_URL)
  const emailContent = {
    membershipNumber: params.membershipNumber,
    temporaryPassword: params.temporaryPassword,
    ...urls,
  }

  try {
    await sendAppEmail(bindings, {
      to: params.recipientEmail,
      subject: 'مرحباً بك في تجمّع إبتكار — بيانات حساب العضوية',
      text: buildRegistrationCredentialsEmailText(emailContent),
      html: buildRegistrationCredentialsEmailHtml(emailContent),
    })
  } catch (error) {
    if (error instanceof RegistrationEmailError) {
      throw error
    }
    throw new RegistrationEmailError('Unable to send registration credentials email at this time. يرجى التواصل مع الأدمين وإخباره', { cause: error })
  }
}
