export type SupportTicketStatus = 'open' | 'waiting_for_reply' | 'resolved'
export type SupportSenderType = 'tenant' | 'support'

export type SupportTicket = {
  id: string
  tenantId: string
  subject: string
  status: SupportTicketStatus
  createdBy: string
  tenantLastSeenAt: string | null
  supportLastSeenAt: string | null
  createdAt: string
  updatedAt: string
  unreadCount?: number
  tenantName?: string
  lastMessage?: string
  lastMessageAt?: string
}

export type SupportMessage = {
  id: string
  ticketId: string
  senderType: SupportSenderType
  senderId: string
  body: string
  imageUrls: string[] | null
  createdAt: string
}
