import { MemberCrud } from '../crud/member';
import { TelegramService } from './telegram';
import { Environment, InlineKeyboardButton } from '../types';

function subscribeKeyboard(env: Environment, callbackData: string): InlineKeyboardButton[][] {
  const channelLink = `https://t.me/${env.MAIN_CHANNEL}`;
  return [
    [{ text: '📢 اشترك في القناة', url: channelLink }],
    [{ text: '✅ تحققت من الاشتراك', callback_data: callbackData }],
  ];
}

export async function startTelegramSignup(
  env: Environment,
  telegramId: number,
  username?: string,
): Promise<void> {
  const telegramService = new TelegramService(env);
  const memberCrud = new MemberCrud(env.MEMBERS_DB);
  const existingMember = await memberCrud.getMemberByTelegramId(telegramId.toString());

  if (existingMember) {
    await telegramService.sendMessage(
      telegramId,
      `أنت مسجل بالفعل برقم العضوية ${existingMember.membership_number}\n\nالاسم: ${existingMember.en_name}\n\nاستخدم /help لعرض الأوامر المتاحة`,
    );
    return;
  }

  const isSubscribed = await telegramService.checkChannelMembership(telegramId, env.MAIN_CHANNEL);
  if (!isSubscribed) {
    const channelLink = `https://t.me/${env.MAIN_CHANNEL}`;
    await telegramService.sendMessage(
      telegramId,
      `للانتساب عبر تيليغرام يجب الاشتراك في قناتنا الرسمية أولاً:\n\n${channelLink}\n\nبعد الاشتراك، اضغط على الزر أدناه للمتابعة`,
      undefined,
      subscribeKeyboard(env, 'check_subscription_signup'),
    );
    return;
  }

  await sendSignupLink(env, telegramId, username);
}

const SIGNUP_INTENT_PATH = '/ms/membership-app/api/internal/signup-intents';

function resolveMembershipMs(env: Environment): string | null {
  const configured = env.MEMBERSHIP_MS?.trim().replace(/\/+$/, '');
  return configured || null;
}

async function createSignupIntent(
  env: Environment,
  telegramId: number,
  username?: string,
): Promise<Response> {
  const membershipMsService = env.MEMBERSHIP_MS_SERVICE;
  const membershipMs = resolveMembershipMs(env);
  const headers = {
    'Content-Type': 'application/json',
    'X-API-Key': env.INTERNAL_SECRET,
  };
  const body = JSON.stringify({
    telegramId: telegramId.toString(),
    telegramUsername: username ?? null,
  });

  // Prefer service binding: same-zone public URL fetches skip Worker routes and can hit the SPA (405).
  if (membershipMsService) {
    return membershipMsService.fetch(`https://membership-ms.internal${SIGNUP_INTENT_PATH}`, {
      method: 'POST',
      headers,
      body,
    });
  }

  if (!membershipMs) {
    throw new Error('Neither MEMBERSHIP_MS_SERVICE binding nor MEMBERSHIP_MS URL is configured');
  }

  return fetch(`${membershipMs}/api/internal/signup-intents`, {
    method: 'POST',
    headers,
    body,
  });
}

export async function sendSignupLink(
  env: Environment,
  telegramId: number,
  username?: string,
): Promise<void> {
  const telegramService = new TelegramService(env);
  if (!env.MEMBERSHIP_MS_SERVICE && !resolveMembershipMs(env)) {
    await telegramService.sendMessage(
      telegramId,
      'تعذّر إنشاء رابط الانتساب حالياً. يرجى المحاولة لاحقاً أو التواصل مع الدعم.',
    );
    return;
  }

  let response: Response;
  try {
    response = await createSignupIntent(env, telegramId, username);
  } catch (error) {
    console.error('Signup intent request failed', error);
    await telegramService.sendMessage(
      telegramId,
      'تعذّر إنشاء رابط الانتساب. حاول إرسال /signup مرة أخرى بعد قليل.',
    );
    return;
  }

  if (response.status === 409) {
    await telegramService.sendMessage(
      telegramId,
      'حساب تيليغرام هذا مرتبط بعضوية موجودة. استخدم /myinfo لعرض بياناتك.',
    );
    return;
  }

  if (!response.ok) {
    console.error(
      'Signup intent request failed',
      response.status,
      env.MEMBERSHIP_MS_SERVICE ? `service-binding:${SIGNUP_INTENT_PATH}` : `${resolveMembershipMs(env)}/api/internal/signup-intents`,
      await response.text().catch(() => ''),
    );
    await telegramService.sendMessage(
      telegramId,
      'تعذّر إنشاء رابط الانتساب. حاول إرسال /signup مرة أخرى بعد قليل.',
    );
    return;
  }

  const body = await response.json() as { url?: string };
  if (!body.url) {
    await telegramService.sendMessage(
      telegramId,
      'تعذّر إنشاء رابط الانتساب. حاول إرسال /signup مرة أخرى بعد قليل.',
    );
    return;
  }

  await telegramService.sendMessage(
    telegramId,
    `رابط انتسابك جاهز. افتحه وأكمل النموذج. الرابط صالح لمدة 24 ساعة ويُستخدم مرة واحدة:\n\n${body.url}`,
  );
}
