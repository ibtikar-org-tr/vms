import { Hono } from 'hono';
import { Environment, TelegramUpdate, InlineKeyboardButton } from '../types';
import { MemberCrud } from '../crud/member';
import { TelegramService } from '../services/telegram';
import { EmailService } from '../services/email';
import { TelegramUserStateService } from '../crud/telegram-user-state';
import { AllMessagesPrivateCrud } from '../crud/all-messages-private';
import { AllMessagesGroupsCrud } from '../crud/all-messages-groups';
import { D1DatabaseConnection } from '../crud/database';
import LLMService from '../services/ai-services/deepseek';
import { AI_CONFIG } from '../utils/ai-config';
import { GroupServices } from '../services/group-services';
import { GroupMemberTrackingService } from '../services/group-member-tracking';
import { handleChatJoinRequest } from '../services/membership-manager/chat-join-request-handler';
import { sendSignupLink, startTelegramSignup } from '../services/signup-command';

const telegram = new Hono<{ Bindings: Environment }>();

// Helper function to generate 6-digit verification code
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

telegram.post('/webhook', async (c) => {
  try {
    const update: TelegramUpdate = await c.req.json();
    
    // Handle callback queries (button clicks)
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const telegramId = callbackQuery.from.id;
      const callbackData = callbackQuery.data;
      const messageId = callbackQuery.message?.message_id;

      const telegramService = new TelegramService(c.env);
      const userStateService = new TelegramUserStateService(c.env);

      if (callbackData === 'check_subscription_signup') {
        const isSubscribed = await telegramService.checkChannelMembership(telegramId, c.env.MAIN_CHANNEL);
        if (isSubscribed) {
          if (messageId) {
            await telegramService.editMessage(
              telegramId,
              messageId,
              '✅ تم التحقق من اشتراكك بنجاح!\n\nجارٍ إنشاء رابط الانتساب...'
            );
          }
          await sendSignupLink(c.env, telegramId, callbackQuery.from.username);
          await fetch(`https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callback_query_id: callbackQuery.id,
              text: '✅ تم التحقق من اشتراكك'
            })
          });
        } else {
          await fetch(`https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callback_query_id: callbackQuery.id,
              text: '❌ لم يتم العثور على اشتراك. يرجى الاشتراك في القناة أولاً',
              show_alert: true
            })
          });
        }
        return c.json({ ok: true });
      }

      // Handle "check_subscription" callback
      if (callbackData === 'check_subscription') {
        // Check if user is now subscribed
        const isSubscribed = await telegramService.checkChannelMembership(telegramId, c.env.MAIN_CHANNEL);
        
        if (isSubscribed) {
          // User is subscribed - proceed with verification
          await userStateService.setUserState(telegramId.toString(), 'waiting_membership_number');
          
          // Edit the message to remove buttons and show success
          if (messageId) {
            await telegramService.editMessage(
              telegramId,
              messageId,
              `✅ تم التحقق من اشتراكك بنجاح!\n\nالآن يرجى إدخال رقم العضوية للتحقق من عضويتك`
            );
          } else {
            await telegramService.sendMessage(
              telegramId,
              `✅ تم التحقق من اشتراكك بنجاح!\n\nالآن يرجى إدخال رقم العضوية للتحقق من عضويتك`
            );
          }

          // Answer the callback query
          await fetch(`https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callback_query_id: callbackQuery.id,
              text: '✅ تم التحقق من اشتراكك'
            })
          });
        } else {
          // User is still not subscribed
          await fetch(`https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callback_query_id: callbackQuery.id,
              text: '❌ لم يتم العثور على اشتراك. يرجى الاشتراك في القناة أولاً',
              show_alert: true
            })
          });
        }
      }

      return c.json({ ok: true });
    }
    
    // Handle chat join requests
    if (update.chat_join_request) {
      return await handleChatJoinRequest(update, c);
    }
    
    if (!update.message) {
      return c.json({ ok: true });
    }

    const { message } = update;
    const telegramId = message.from.id;
    const username = message.from.username;
    const text = message.text || '';
    const chatType = message.chat.type; // 'private', 'group', 'supergroup', or 'channel'

    // Store all received messages in appropriate database table
    try {
      const messagesDb = new D1DatabaseConnection(c.env.TELEGRAM_MESSAGES_DB);
      
      if (chatType === 'private') {
        // Store private messages
        const messagesCrud = new AllMessagesPrivateCrud(messagesDb);
        await messagesCrud.storeMessage(update.message);
      } else if (chatType === 'group' || chatType === 'supergroup') {
        // Store group messages
        const groupMessagesCrud = new AllMessagesGroupsCrud(messagesDb);
        await groupMessagesCrud.storeMessage(update.message);
        
        // Track member changes
        const telegramDb = new D1DatabaseConnection(c.env.TELEGRAM_DB);
        const memberTrackingService = new GroupMemberTrackingService(telegramDb);
        await memberTrackingService.processMessage(update.message);
        
        // Delete join/leave service messages immediately
        // Check if this is a member join or leave message
        const isJoinLeaveMessage = message.new_chat_members || message.left_chat_member;
        if (isJoinLeaveMessage && message.message_id) {
          const telegramService = new TelegramService(c.env);
          try {
            await telegramService.deleteMessage(message.chat.id, message.message_id);
            console.log(`Deleted join/leave service message ${message.message_id} in chat ${message.chat.id}`);
          } catch (deleteError) {
            // Log error but don't fail - the message might have already been deleted
            console.error('Failed to delete join/leave message:', deleteError);
          }
        }
      }
    } catch (storageError) {
      // Log error but don't fail the request - message processing should continue
      console.error('Failed to store message:', storageError);
    }

    // Handle group-specific commands
    if (chatType !== 'private') {
      const command = text.trim().split(/\s+/)[0].toLowerCase();

      // Handle /info command in groups
      if (/^\/info(@\w+)?$/.test(command)) {
        const telegramService = new TelegramService(c.env);

        const chatId = message.chat.id;
        const chatIdAsString = chatId.toString();

        let chatInfo: any = null;
        let memberCount = 0;
        let adminCount = 0;

        try {
          chatInfo = await telegramService.getChat(chatId);
        } catch (error) {
          console.warn(`Failed to fetch live chat info for ${chatId}:`, error);
        }

        try {
          memberCount = await telegramService.getChatMemberCount(chatId);
        } catch (error) {
          console.warn(`Failed to fetch member count for ${chatId}:`, error);
        }

        try {
          const admins = await telegramService.getChatAdministrators(chatId);
          adminCount = admins.length;
        } catch (error) {
          console.warn(`Failed to fetch admins for ${chatId}:`, error);
        }

        const title = chatInfo?.title || message.chat.title || 'Unknown';
        const type = chatInfo?.type || message.chat.type || 'unknown';
        const username = chatInfo?.username || message.chat.username || null;
        const description = chatInfo?.description || null;
        const forumEnabled = Boolean(chatInfo?.is_forum || message.chat.is_forum);

        let infoMessage = 'Group Info\n\n';
        infoMessage += `Title: ${title}\n`;
        infoMessage += `Chat ID: ${chatIdAsString}\n`;
        infoMessage += `Type: ${type}\n`;
        infoMessage += `Members: ${memberCount}\n`;
        infoMessage += `Admins: ${adminCount}\n`;
        infoMessage += `Forum Topics: ${forumEnabled ? 'Enabled' : 'Disabled'}\n`;

        if (username) {
          infoMessage += `Username: @${username}\n`;
        }
        if (description) {
          infoMessage += `Description: ${description}\n`;
        }

        await telegramService.sendMessage(
          chatId,
          infoMessage.trim(),
          undefined,
          undefined,
          message.message_thread_id,
          message.message_id
        );
        return c.json({ ok: true });
      }

      // Handle /summarize command in groups
      if (text.startsWith('/summarize')) {
        const groupServices = new GroupServices(c.env);
        // Pass message_thread_id if present (for forum topics)
        const messageThreadId = message.message_thread_id;
        const commandMessageId = message.message_id;
        await groupServices.handleSummarizeCommand(message.chat.id, text, messageThreadId, commandMessageId);
        return c.json({ ok: true });
      }
      
      // For other group messages, we just store them and return
      return c.json({ ok: true });
    }

    const telegramService = new TelegramService(c.env);
    const memberCrud = new MemberCrud(c.env.MEMBERS_DB);
    const emailService = new EmailService(c.env);
    const userStateService = new TelegramUserStateService(c.env);

    // Helper function to mask email for privacy
    const maskEmail = (email: string): string => {
      if (!email || !email.includes('@')) {
        return email;
      }
      const [localPart, domain] = email.split('@');
      if (localPart.length <= 3) {
        return `${localPart[0]}****${localPart[localPart.length - 1]}@${domain}`;
      }
      const maskedLocal = `${localPart.slice(0, 3)}****${localPart.slice(-2)}`;
      return `${maskedLocal}@${domain}`;
    };

    const commandToken = text.trim().split(/\s+/)[0]?.split('@')[0]?.toLowerCase();
    const commandArg = text.trim().split(/\s+/).slice(1).join(' ').toLowerCase();

    if (commandToken === '/signup' || (commandToken === '/start' && commandArg === 'signup')) {
      await startTelegramSignup(c.env, telegramId, username);
      return c.json({ ok: true });
    }

    // Handle /start command
    if (text === '/start' || commandToken === '/start') {
      await telegramService.sendWelcomeMessage(telegramId);
      return c.json({ ok: true });
    }

    // Handle /verify command
    if (text === '/verify') {
      // Check if user is already registered
      const existingMember = await memberCrud.getMemberByTelegramId(telegramId.toString());
      
      if (existingMember) {
        // User is already registered
        await userStateService.clearUserState(telegramId.toString());
        await telegramService.sendMessage(
          telegramId,
          `أنت مسجل بالفعل برقم العضوية ${existingMember.membership_number}\n\nالاسم: ${existingMember.en_name}\n\nاستخدم /help لعرض الأوامر المتاحة`
        );
        return c.json({ ok: true });
      }

      // Check if user is subscribed to the main channel
      const isSubscribed = await telegramService.checkChannelMembership(telegramId, c.env.MAIN_CHANNEL);
      
      if (!isSubscribed) {
        // User is not subscribed - send message with channel link
        const channelLink = `https://t.me/${c.env.MAIN_CHANNEL}`;
        const subscribeButton: InlineKeyboardButton[][] = [
          [
            {
              text: '📢 اشترك في القناة',
              url: channelLink
            }
          ],
          [
            {
              text: '✅ تحققت من الاشتراك',
              callback_data: 'check_subscription'
            }
          ]
        ];

        await telegramService.sendMessage(
          telegramId,
          `للتحقق من عضويتك، يجب عليك أولاً الاشتراك في قناتنا الرسمية:\n\n${channelLink}\n\nبعد الاشتراك، اضغط على الزر أدناه للمتابعة`,
          undefined,
          subscribeButton
        );
        return c.json({ ok: true });
      }

      // User is subscribed - proceed with verification
      // New user - set state to wait for membership number
      await userStateService.setUserState(telegramId.toString(), 'waiting_membership_number');
      await telegramService.sendMessage(
        telegramId,
        `يرجى إدخال رقم العضوية للتحقق من عضويتك`
      );
      return c.json({ ok: true });
    }

    // Handle /help command
    if (text === '/help') {
      await telegramService.sendHelpMessage(telegramId);
      return c.json({ ok: true });
    }

    // Handle /info command - show membership information
    if (text === '/info' || text === '/myinfo' || text === '/iforgot') {
      const existingMember = await memberCrud.getMemberByTelegramId(telegramId.toString());
      
      if (!existingMember) {
        await telegramService.sendMessage(
          telegramId,
          'لم يتم العثور على معلومات العضوية. يرجى استخدام /verify لتسجيل حسابك'
        );
        return c.json({ ok: true });
      }

      // Build membership info message
      const infoText = `
معلومات العضوية 📋

🆔 رقم العضوية: ${existingMember.membership_number}
👤 الاسم بالعربية: ${existingMember.ar_name || 'غير متوفر'}
👤 الاسم اللاتيني: ${existingMember.en_name || 'غير متوفر'}
📧 البريد الإلكتروني: ${existingMember.email || 'غير متوفر'}
📱 الهاتف: ${existingMember.phone || 'غير متوفر'}

هذه المعلومات مسجلة في نظامنا.
      `.trim();

      await telegramService.sendMessage(telegramId, infoText);
      return c.json({ ok: true });
    }

    // Get user's current state
    const currentState = await userStateService.getUserStateValue(telegramId.toString());

    // Handle based on current state
    switch (currentState) {
      case 'waiting_membership_number':
        // Process membership number
        await handleMembershipNumberInput(
          text.trim(),
          telegramId,
          username,
          memberCrud,
          emailService,
          telegramService,
          userStateService,
          maskEmail,
          c.env
        );
        break;

      case 'waiting_verification_code':
        // Process verification code
        await handleVerificationCodeInput(
          text.trim(),
          telegramId,
          username,
          memberCrud,
          telegramService,
          userStateService,
          c.env
        );
        break;

      case 'normal':
      default:
        // Normal state - handle with AI for non-command messages
        if (!text.startsWith('/')) {
          try {
            // Send "Thinking..."
            const thinkingMessageId = await telegramService.sendMessage(
              telegramId,
              '⏳ جارٍ التفكير...'
            );

            // Get today's conversation history for this user
            const db = new D1DatabaseConnection(c.env.TELEGRAM_MESSAGES_DB);
            const messagesCrud = new AllMessagesPrivateCrud(db);
            const todaysConversation = await messagesCrud.getTodaysConversation(telegramId, 100);

            const llmService = new LLMService(c.env);
            
            // Build conversation history with today's messages and task context
            let aiResponse: string;
            
            const conversationHistory: Array<{
              role: 'system' | 'user' | 'assistant';
              content: string;
            }> = [];

            const systemPrompt = AI_CONFIG;

            // Add system prompt first
            conversationHistory.push({
              role: 'system',
              content: systemPrompt
            });

            // Add today's conversation (if any)
            if (todaysConversation.length > 0) {
              for (const msg of todaysConversation) {
                // Skip command messages
                if (!msg.content.startsWith('/')) {
                  conversationHistory.push({
                    role: msg.role,
                    content: msg.content
                  });
                }
              }
            }

            // Add the current message if it's not already the last one
            const lastMessage = todaysConversation[todaysConversation.length - 1];
            if (!lastMessage || lastMessage.content !== text || lastMessage.role !== 'user') {
              conversationHistory.push({
                role: 'user',
                content: text
              });
            }

            // Use chatWithHistory if we have conversation context, otherwise use simple chat
            if (conversationHistory.length > 1) {
              aiResponse = await llmService.chatWithHistory(conversationHistory);
            } else {
              aiResponse = await llmService.chat(text, systemPrompt);
            }

            // Store the bot response for future conversation context
            await messagesCrud.storeBotResponse(telegramId, text, aiResponse);

            // Edit the "Thinking..." message with the AI response
            if (thinkingMessageId) {
              await telegramService.editMessage(
                telegramId,
                thinkingMessageId,
                aiResponse
              );
            } else {
              // Fallback: send as new message if editing fails
              await telegramService.sendMessage(telegramId, aiResponse);
            }
          } catch (aiError) {
            console.error('AI error:', aiError);
            // Fallback to help message if AI fails
            await telegramService.sendHelpMessage(telegramId);
          }
        } else {
          // For unknown commands, show help menu
          await telegramService.sendHelpMessage(telegramId);
        }
        break;
    }

    return c.json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Helper function to handle membership number input
async function handleMembershipNumberInput(
  membershipNumber: string,
  telegramId: number,
  username: string | undefined,
  memberCrud: MemberCrud,
  emailService: EmailService,
  telegramService: TelegramService,
  userStateService: TelegramUserStateService,
  maskEmail: (email: string) => string,
  env: Environment
) {
  const member = await memberCrud.getMemberByMembershipNumber(membershipNumber);
  
  if (!member) {
    await telegramService.sendMessage(
      telegramId,
      'رقم العضوية غير موجود في قاعدة البيانات. يرجى التحقق من رقم عضويتك والمحاولة مرة أخرى، أو الاتصال بالدعم.\n\nاستخدم /help للأوامر المتاحة'
    );
    // Clear state so user can try again or use other commands
    await userStateService.clearUserState(telegramId.toString());
    return;
  }

  // Check if member has an email address
  if (!member.email) {
    await telegramService.sendMessage(
      telegramId,
      'لم يتم العثور على عنوان بريد إلكتروني لهذه العضوية. يرجى الاتصال بالدعم لتحديث عنوان بريدك الإلكتروني'
    );
    await userStateService.clearUserState(telegramId.toString());
    return;
  }

  // Check if this telegram_id is already registered
  const existingMember = await memberCrud.getMemberByTelegramId(telegramId.toString());
  if (existingMember) {
    await telegramService.sendMessage(
      telegramId,
      'حساب تيليجرام هذا مسجل بالفعل. يرجى الاتصال بالمسؤول إذا كنت بحاجة إلى مساعدة'
    );
    await userStateService.clearUserState(telegramId.toString());
    return;
  }

  // Check if this membership number is already linked to another Telegram account
  if (member.telegram_id && member.telegram_id !== telegramId.toString()) {
    await telegramService.sendMessage(
      telegramId,
      'رقم العضوية هذا مسجل بالفعل مع حساب تيليجرام آخر. إذا كنت تعتقد أن هذا خطأ، يرجى الاتصال بالدعم للحصول على المساعدة'
    );
    await userStateService.clearUserState(telegramId.toString());
    return;
  }

  // Generate 6-digit verification code
  const verificationCode = generateVerificationCode();
  
  // Store verification code and membership number in user state notes
  // Format: code|membership_number|username
  const stateData = `${verificationCode}|${member.membership_number}|${username || ''}`;
  await userStateService.setUserState(telegramId.toString(), 'waiting_verification_code', stateData);

  // Create verification link with query parameters
  const verificationLink = `${env.TELEGRAM_MS}/ms/telegram/telegram/verify?membership_number=${encodeURIComponent(member.membership_number)}&telegram_id=${telegramId}&telegram_username=${encodeURIComponent(username || '')}`;

  // Send verification email with code
  await emailService.sendVerificationEmail(member.email, verificationLink, verificationCode);
  
  // Show masked email to user
  const maskedEmail = maskEmail(member.email);
  
  await telegramService.sendMessage(
    telegramId,
    `تم إرسال بريد التحقق إلى ${maskedEmail}\n\nيمكنك:\n1. إدخال الرمز المكون من 6 أرقام من البريد الإلكتروني هنا في المحادثة\n2. النقر على رابط التحقق في البريد الإلكتروني\n\nسينتهي صلاحية الرمز خلال 10 دقائق`
  );
}

// Helper function to handle verification code input
async function handleVerificationCodeInput(
  code: string,
  telegramId: number,
  username: string | undefined,
  memberCrud: MemberCrud,
  telegramService: TelegramService,
  userStateService: TelegramUserStateService,
  env: Environment
) {
  // Get the stored verification data from notes
  const stateNotes = await userStateService.getUserStateNotes(telegramId.toString());
  
  if (!stateNotes) {
    await telegramService.sendMessage(
      telegramId,
      'انتهت صلاحية جلسة التحقق أو لم يتم العثور عليها. يرجى استخدام /verify للبدء من جديد'
    );
    await userStateService.clearUserState(telegramId.toString());
    return;
  }

  // Parse stored data: code|membership_number|username
  const [storedCode, membershipNumber, storedUsername] = stateNotes.split('|');
  
  // Validate code
  if (code !== storedCode) {
    await telegramService.sendMessage(
      telegramId,
      'رمز التحقق غير صحيح. يرجى التحقق والمحاولة مرة أخرى، أو استخدام الرابط من بريدك الإلكتروني\n\nاستخدم /verify لطلب رمز جديد'
    );
    // Don't clear state - let user try again or wait for timeout
    return;
  }

  // Code is correct - proceed with verification
  const member = await memberCrud.getMemberByMembershipNumber(membershipNumber);
  
  if (!member) {
    await telegramService.sendMessage(
      telegramId,
      'لم يتم العثور على العضو. يرجى الاتصال بالدعم'
    );
    await userStateService.clearUserState(telegramId.toString());
    return;
  }

  // Check if this telegram_id is already registered to any user
  const existingMember = await memberCrud.getMemberByTelegramId(telegramId.toString());
  if (existingMember) {
    await telegramService.sendMessage(
      telegramId,
      'حساب تيليجرام هذا مسجل بالفعل. يرجى الاتصال بالمسؤول'
    );
    await userStateService.clearUserState(telegramId.toString());
    return;
  }

  // Update member with Telegram information
  await memberCrud.updateMember({
    membership_number: membershipNumber,
    telegram_id: telegramId.toString(),
    telegram_username: username || storedUsername || ''
  });

  // Clear user state since they're now registered
  await userStateService.clearUserState(telegramId.toString());

  // Send confirmation message
  await telegramService.sendMessage(
    telegramId,
    `✅ تم التحقق بنجاح!\n\nأنت الآن مسجل لتلقي الرسائل من منظمتنا.\n\nعضويتك: ${member.en_name} - ${membershipNumber}\n\nاستخدم /help لعرض الأوامر المتاحة`
  );
}

telegram.get('/verify', async (c) => {
  try {
    const membershipNumber = c.req.query('membership_number');
    const telegramId = c.req.query('telegram_id');
    const telegramUsername = c.req.query('telegram_username') || '';
    
    if (!membershipNumber || !telegramId) {
      return c.html('<h1>رابط تحقق غير صالح</h1><p>المعاملات المطلوبة مفقودة.</p>');
    }

    const memberCrud = new MemberCrud(c.env.MEMBERS_DB);
    const telegramService = new TelegramService(c.env);
    const userStateService = new TelegramUserStateService(c.env);

    // Check if the membership number exists
    const member = await memberCrud.getMemberByMembershipNumber(membershipNumber);
    if (!member) {
      return c.html('<h1>فشل التحقق</h1><p>لم يتم العثور على العضو. يرجى الاتصال بالدعم.</p>');
    }

    // Check if this telegram_id is already registered to any user
    const existingMember = await memberCrud.getMemberByTelegramId(telegramId);
    if (existingMember) {
      return c.html('<h1>المستخدم موجود بالفعل</h1><p>حساب تيليجرام هذا مسجل بالفعل. يرجى الاتصال بالمسؤول.</p>');
    }

    // Update member with Telegram information
    await memberCrud.updateMember({
      membership_number: membershipNumber,
      telegram_id: telegramId,
      telegram_username: telegramUsername
    });

    // Clear any existing user state since they're now registered
    await userStateService.clearUserState(telegramId);

    // Send confirmation message
    await telegramService.sendMessage(
      parseInt(telegramId),
      `تم التحقق بنجاح. أنت الآن مسجل لتلقي الرسائل من منظمتنا.\n\nعضويتك: ${member.en_name}، ${membershipNumber}\n\nاستخدم /help لعرض الأوامر المتاحة`
    );

    return c.html(`
      <h1>تم التحقق بنجاح!</h1>
      <p>مرحباً ${member.en_name}،</p>
      <p>تم ربط حساب تيليجرام الخاص بك بعضويتك (${membershipNumber}) بنجاح.</p>
      <p>يمكنك الآن إغلاق هذه النافذة والعودة إلى تيليجرام.</p>
    `);
  } catch (error) {
    console.error('Verification error:', error);
    return c.html('<h1>فشل التحقق</h1><p>حدث خطأ أثناء التحقق. يرجى المحاولة مرة أخرى أو الاتصال بالدعم.</p>');
  }
});

export default telegram;