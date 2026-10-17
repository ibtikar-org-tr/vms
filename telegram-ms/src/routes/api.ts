import { Hono } from 'hono';
import { Environment } from '../types';
import { MemberCrud } from '../crud/member';
import { TelegramService } from '../services/telegram';
import { authMiddleware } from '../middleware/auth';
import { sendMessageToMember } from '../services/membership-manager/member-services';

const api = new Hono<{ Bindings: Environment }>();

// Apply auth middleware to all API routes
api.use('*', authMiddleware);

api.post('/send-message', async (c) => {
  try {
    const { message, target } = await c.req.json();
    
    if (!message) {
      return c.json({ error: 'Message is required' }, 400);
    }

    const telegramService = new TelegramService(c.env);
    const memberCrud = new MemberCrud(c.env.MEMBERS_DB);

    if (target === 'all') {
      // Send to all members with telegram_id
      const members = await memberCrud.getMembers();
      const telegramIds = members
        .filter(member => member.telegram_id)
        .map(member => member.telegram_id);

      if (telegramIds.length === 0) {
        return c.json({ error: 'No members with Telegram IDs found' }, 404);
      }

      await telegramService.sendBulkMessage(telegramIds, message);
      
      return c.json({ 
        success: true, 
        message: `Message sent to ${telegramIds.length} members` 
      });
    } else if (target) {
      // Send to specific member by membership number or email
      let member = await memberCrud.getMemberByMembershipNumber(target);
      
      if (!member) {
        member = await memberCrud.getMemberByEmail(target);
      }

      if (!member) {
        return c.json({ error: 'Member not found' }, 404);
      }

      if (!member.telegram_id) {
        return c.json({ error: 'Member has not registered for Telegram notifications' }, 400);
      }

      await telegramService.sendMessage(member.telegram_id, message);
      
      return c.json({ 
        success: true, 
        message: `Message sent to ${member.en_name}` 
      });
    } else {
      return c.json({ error: 'Target is required (use "all" for all members or specific membership number/email)' }, 400);
    }
  } catch (error) {
    console.error('Send message error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

api.post('/notify-member', async (c) => {
  try {
    let member_ids: string | string[];
    let message: string;
    let boxes: Array<{ text: string, link: string }> | undefined;
    let photo: string | Blob | undefined;

    const contentType = c.req.header('Content-Type') || '';

    if (contentType.includes('multipart/form-data')) {
      // Handle multipart form data
      const formData = await c.req.formData();

      const memberIdStr = formData.get('member_id') as string;
      const memberIdsStr = formData.get('member_ids') as string;

      if (memberIdsStr) {
        try {
          member_ids = JSON.parse(memberIdsStr);
          if (!Array.isArray(member_ids)) {
            return c.json({ error: 'member_ids must be an array when provided as JSON string' }, 400);
          }
        } catch (e) {
          return c.json({ error: 'Invalid member_ids format. Must be valid JSON array string' }, 400);
        }
      } else if (memberIdStr) {
        member_ids = memberIdStr;
      } else {
        return c.json({ error: 'Either member_id or member_ids is required' }, 400);
      }

      message = formData.get('message') as string;

      const boxesStr = formData.get('boxes') as string;
      if (boxesStr) {
        try {
          boxes = JSON.parse(boxesStr);
        } catch (e) {
          return c.json({ error: 'Invalid boxes format. Must be valid JSON string' }, 400);
        }
      }

      const photoFile = formData.get('photo') as File;
      if (photoFile) {
        // Convert file to Blob
        const arrayBuffer = await photoFile.arrayBuffer();
        photo = new Blob([arrayBuffer], { type: photoFile.type || 'image/jpeg' });
      }
    } else {
      // Handle JSON data
      const { member_id, member_ids: jsonMemberIds, message: jsonMessage, boxes: jsonBoxes, photo: jsonPhoto } = await c.req.json();
      console.log('📨 Received JSON request:', { member_id, member_ids: jsonMemberIds, message: jsonMessage, boxes: jsonBoxes, photo: jsonPhoto });

      if (jsonMemberIds !== undefined) {
        if (!Array.isArray(jsonMemberIds)) {
          return c.json({ error: 'member_ids must be an array' }, 400);
        }
        member_ids = jsonMemberIds;
      } else if (member_id) {
        member_ids = member_id;
      } else {
        return c.json({ error: 'Either member_id or member_ids is required' }, 400);
      }

      message = jsonMessage;
      boxes = jsonBoxes;
      photo = jsonPhoto; // This should be a URL or file_id string
    }

    if (!message) {
      return c.json({ error: 'message is required' }, 400);
    }

    // Normalize member_ids to array
    const memberIdsArray = Array.isArray(member_ids) ? member_ids : [member_ids];

    if (memberIdsArray.length === 0) {
      return c.json({ error: 'At least one member ID is required' }, 400);
    }

    // Process each member
    const results = [];
    const successful = [];
    const failed = [];

    for (const memberId of memberIdsArray) {
      if (typeof memberId !== 'string' || !memberId.trim()) {
        failed.push({ member_id: memberId, error: 'Invalid member ID format' });
        continue;
      }

      try {
        const result = await sendMessageToMember(c.env, memberId.trim(), message, boxes || [], photo);

        if (result.error) {
          failed.push({ member_id: memberId.trim(), error: result.error });
        } else {
          successful.push({
            member_id: memberId.trim(),
            telegram_id: result.telegram_id,
            message: result.message
          });
        }
      } catch (error) {
        failed.push({
          member_id: memberId.trim(),
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    if (successful.length === 0) {
      return c.json({
        error: 'Failed to send message to any members',
        results: { successful, failed }
      }, 400);
    }

    return c.json({
      success: true,
      message: `Message sent to ${successful.length} out of ${memberIdsArray.length} members`,
      results: { successful, failed },
      total_requested: memberIdsArray.length,
      sent_to: successful.length,
      failed_count: failed.length
    });
  } catch (error) {
    console.error('Notify member error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

api.post('/group-invite', async (c) => {
  try {
    const { member_id, group_id, context_label } = await c.req.json();

    if (!member_id || typeof member_id !== 'string') {
      return c.json({ error: 'member_id is required' }, 400);
    }

    if (!group_id || typeof group_id !== 'string') {
      return c.json({ error: 'group_id is required' }, 400);
    }

    const memberCrud = new MemberCrud(c.env.MEMBERS_DB);
    const telegramService = new TelegramService(c.env);
    const member = await memberCrud.getMemberByMembershipNumber(member_id.trim());

    if (!member) {
      return c.json({ error: 'Member not found', error_code: 'MEMBER_NOT_FOUND' }, 404);
    }

    if (!member.telegram_id) {
      return c.json(
        { error: 'Member has not registered for Telegram notifications', error_code: 'NO_TELEGRAM_ID' },
        400,
      );
    }

    const inviteResult = await telegramService.createChatInviteLinkDetailed(
      group_id.trim(),
      Number(member.telegram_id),
      member.en_name || member.membership_number,
    );

    if (!inviteResult.success) {
      if (inviteResult.errorCode === 'INSUFFICIENT_RIGHTS') {
        await telegramService.sendMessage(
          member.telegram_id,
          'تعذر إصدار رابط دعوة للمجموعة حالياً لأن البوت لا يملك صلاحية الإدارة. الرجاء إبلاغ المسؤول.',
        );

        return c.json(
          {
            error: 'Bot lacks admin rights to create invite links. Error message was sent to member.',
            error_code: 'INSUFFICIENT_RIGHTS',
          },
          403,
        );
      }

      return c.json(
        {
          error: 'Failed to create telegram group invite link',
          error_code: inviteResult.errorCode,
          details: inviteResult.error,
        },
        500,
      );
    }

    const contextLabelText = typeof context_label === 'string' && context_label.trim() ? context_label.trim() : 'هذه المساحة';
    const inviteMessage = `تم تجهيز رابط الانضمام لمجموعة التلغرام الخاصة بـ ${contextLabelText}.`;
    await telegramService.sendMessageWithBoxes(member.telegram_id, inviteMessage, [
      { text: 'الانضمام إلى مجموعة التلغرام', link: inviteResult.inviteLink },
    ]);

    return c.json({
      success: true,
      message: `Invite link sent to ${member.en_name || member.membership_number}`,
      member_id: member.membership_number,
      telegram_id: member.telegram_id,
    });
  } catch (error) {
    console.error('Group invite error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

api.post('/webhook/setup', async (c) => {
  try {
    const telegramService = new TelegramService(c.env);
    const webhookUrl = `${c.env.TELEGRAM_MS}/telegram/webhook`;
    
    await telegramService.setWebhook(webhookUrl);
    
    return c.json({ 
      success: true, 
      message: 'Webhook setup successfully',
      webhook_url: webhookUrl 
    });
  } catch (error) {
    console.error('Webhook setup error:', error);
    return c.json({ error: 'Failed to setup webhook' }, 500);
  }
});

api.post('/announcement', async (c) => {
  try {
    console.log('📢 Announcement endpoint called');
    let message: string;
    let parse_mode: string | undefined;
    let photo: Blob | undefined;
    let document: Blob | undefined;
    let filename: string | undefined;

    const contentType = c.req.header('Content-Type') || '';
    console.log('Content-Type:', contentType);

    if (contentType.includes('multipart/form-data')) {
      // Handle multipart form data (for file/photo uploads)
      const formData = await c.req.formData();
      console.log('✅ FormData parsed successfully');
      
      message = formData.get('message') as string;
      parse_mode = (formData.get('parse_mode') as string) || undefined;
      console.log('Message length:', message?.length || 0, 'Parse mode:', parse_mode);
      
      // Handle photo upload
      const photoFile = formData.get('photo') as File;
      if (photoFile && photoFile.size > 0) {
        console.log('📷 Photo file received:', photoFile.name, 'Size:', photoFile.size, 'Type:', photoFile.type);
        const arrayBuffer = await photoFile.arrayBuffer();
        photo = new Blob([arrayBuffer], { type: photoFile.type || 'image/jpeg' });
      }

      // Handle document/file upload
      const documentFile = formData.get('document') as File;
      if (documentFile && documentFile.size > 0) {
        // Pass File directly instead of converting to Blob to preserve proper encoding
        console.log('📄 Document file received:', documentFile.name, 'Size:', documentFile.size, 'Type:', documentFile.type);
        document = documentFile;
        filename = documentFile.name || 'document';
      }
    } else {
      // Handle JSON data (text-only announcements)
      const jsonData = await c.req.json();
      message = jsonData.message;
      parse_mode = jsonData.parse_mode;
      console.log('✅ JSON data parsed successfully. Message length:', message?.length || 0);
    }
    
    if (!message) {
      console.warn('⚠️ Message is required but not provided');
      return c.json({ error: 'Message is required' }, 400);
    }

    // Check that only one attachment type is provided
    if (photo && document) {
      console.warn('⚠️ Both photo and document provided. Only one attachment type allowed.');
      return c.json({ 
        error: 'Cannot send both photo and document. Please send only one attachment type.' 
      }, 400);
    }

    const telegramService = new TelegramService(c.env);
    const memberCrud = new MemberCrud(c.env.MEMBERS_DB);

    // Fetch all members from Google Sheet
    console.log('📋 Fetching members from Google Sheet...');
    const members = await memberCrud.getMembers();
    console.log('✅ Retrieved', members.length, 'total members');
    
    // Filter members who have telegram_id
    const membersWithTelegram = members.filter(member => member.telegram_id && member.telegram_id.trim() !== '');
    console.log('✅ Filtered', membersWithTelegram.length, 'members with Telegram IDs');
    
    if (membersWithTelegram.length === 0) {
      console.warn('⚠️ No members with Telegram IDs found in the sheet');
      return c.json({ 
        error: 'No members with Telegram IDs found in the sheet' 
      }, 404);
    }

    // Extract telegram IDs
    const telegramIds = membersWithTelegram.map(member => member.telegram_id);

    // Send announcement based on attachment type
    console.log('📤 Starting announcement delivery to', telegramIds.length, 'recipients');
    const attachmentType = photo ? 'photo' : document ? 'document' : 'text';
    console.log('📌 Attachment type:', attachmentType);
    
    if (photo) {
      // Send as photo with caption
      console.log('🖼️ Sending photo announcements...');
      await telegramService.sendBulkPhoto(telegramIds, photo, message, parse_mode);
    } else if (document) {
      // Send as document with caption
      console.log('📄 Sending document announcements...');
      await telegramService.sendBulkDocument(telegramIds, document, message, parse_mode, filename);
    } else {
      // Send as text message
      console.log('💬 Sending text announcements...');
      await telegramService.sendBulkMessage(telegramIds, message, parse_mode);
    }
    console.log('✅ Announcement delivery completed');
    
    return c.json({ 
      success: true, 
      message: `Announcement sent successfully`,
      total_members: members.length,
      members_with_telegram: membersWithTelegram.length,
      members_notified: telegramIds.length,
      attachment_type: photo ? 'photo' : document ? 'document' : 'text'
    });
  } catch (error) {
    console.error('❌ Announcement error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return c.json({ 
      error: 'Failed to send announcement',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

api.post('/notify-telegram-id', async (c) => {
  try {
    const body = await c.req.json() as { telegram_id?: string; message?: string };
    const telegramId = body.telegram_id?.trim();
    const message = body.message?.trim();

    if (!telegramId || !message) {
      return c.json({ error: 'telegram_id and message are required' }, 400);
    }

    const telegramService = new TelegramService(c.env);
    await telegramService.sendMessage(telegramId, message);
    return c.json({ success: true });
  } catch (error) {
    console.error('Failed to notify telegram id', error);
    return c.json({ error: 'Failed to send Telegram message' }, 500);
  }
});

export default api;