import type { AppBindings, AssemblyAnnouncementQueueMessage, QueueMessageBatchLike } from '../types/bindings'
import { announcementNeedsContinue, deliverAssemblyAnnouncement, enqueueAnnouncementDelivery } from './assembly-announcement.service'
import { updateAssemblyAnnouncementProgress } from '../repositories/assembly-announcements.repository'

export async function handleAssemblyAnnouncementQueue(
  batch: QueueMessageBatchLike<AssemblyAnnouncementQueueMessage>,
  env: AppBindings,
) {
  for (const message of batch.messages) {
    const announcementId = message.body?.announcementId?.trim()
    if (!announcementId) {
      message.ack()
      continue
    }

    try {
      const announcement = await deliverAssemblyAnnouncement(env, announcementId)
      if (!announcement) {
        message.ack()
        continue
      }

      const needsMore = await announcementNeedsContinue(env, announcement)
      if (needsMore) {
        const queued = await enqueueAnnouncementDelivery(env, announcementId, 2)
        if (!queued) {
          throw new Error('طابور الإرسال غير متاح لمتابعة الرسالة.')
        }
      }

      message.ack()
    } catch (error) {
      console.error('Failed to process assembly announcement queue message', {
        announcementId,
        attempts: message.attempts,
        error,
      })

      if ((message.attempts ?? 1) >= 6) {
        await updateAssemblyAnnouncementProgress(env.VMS_DB, announcementId, {
          lastError: 'توقف الإرسال في الطابور. اضغط متابعة الإرسال.',
        }).catch(() => undefined)
        message.ack()
        continue
      }

      message.retry({ delaySeconds: Math.min(60, 8 * (message.attempts ?? 1)) })
    }
  }
}
