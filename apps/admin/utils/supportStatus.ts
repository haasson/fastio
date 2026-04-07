import type { SupportTicketStatus } from '@fastio/shared'

export const supportStatusMap: Record<SupportTicketStatus, { type: 'warning' | 'primary' | 'default'; label: string }> = {
  open: { type: 'warning', label: 'Открыт' },
  waiting_for_reply: { type: 'primary', label: 'Ожидает ответа' },
  resolved: { type: 'default', label: 'Закрыт' },
}
