import type { VmsEvent } from '../types/vms'

export function canManageVmsEvent(event: Pick<VmsEvent, 'canManage'> | null | undefined) {
  return event?.canManage === true
}
