import { z } from 'zod'
import { tool } from 'ai'
import { getServerSupabase } from '~/server/utils/supabase'

export function createAiTools(tenantId: string, userId: string) {
  return {
    createSupportTicket: tool({
      description: 'Создать обращение в поддержку Fastio. Используй только после явного согласия пользователя.',
      inputSchema: z.object({
        subject: z.string().describe('Тема обращения — краткое описание проблемы'),
        body: z.string().describe('Подробное описание проблемы'),
      }),
      execute: async ({ subject, body }) => {
        const sb = getServerSupabase()

        const { data: ticket, error: ticketError } = await sb
          .from('support_tickets')
          .insert({
            tenant_id: tenantId,
            subject,
            created_by: userId,
          })
          .select('id, subject')
          .single()

        if (ticketError || !ticket) {
          return { success: false, error: 'Не удалось создать обращение' }
        }

        const { error: msgError } = await sb
          .from('support_messages')
          .insert({
            ticket_id: ticket.id,
            sender_type: 'tenant',
            sender_id: userId,
            body,
          })

        if (msgError) {
          return { success: false, error: 'Обращение создано, но не удалось отправить сообщение' }
        }

        return {
          success: true,
          ticketId: ticket.id,
          subject: ticket.subject,
          url: '/help/support',
        }
      },
    }),
  }
}
