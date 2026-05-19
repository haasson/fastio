import { describe, it, expect } from 'vitest'
import { mapOrderNote } from '../api/order-notes'

const makeNoteRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'note-1',
  order_id: 'order-1',
  tenant_id: 'tenant-1',
  author_id: 'user-1',
  author_name: 'Мария',
  author_role: 'admin',
  content: 'Позвонить клиенту перед доставкой',
  created_at: '2026-03-15T11:30:00Z',
  ...overrides,
})

describe('mapOrderNote', () => {
  it('маппит все поля', () => {
    const n = mapOrderNote(makeNoteRow())

    expect(n.id).toBe('note-1')
    expect(n.orderId).toBe('order-1')
    expect(n.tenantId).toBe('tenant-1')
    expect(n.authorId).toBe('user-1')
    expect(n.authorName).toBe('Мария')
    expect(n.authorRole).toBe('admin')
    expect(n.content).toBe('Позвонить клиенту перед доставкой')
    expect(n.createdAt).toBe('2026-03-15T11:30:00Z')
  })

  it('content может быть пустой строкой', () => {
    const n = mapOrderNote(makeNoteRow({ content: '' }))

    expect(n.content).toBe('')
  })

  it('author_role маппится для разных ролей', () => {
    const roles = ['admin', 'manager', 'staff', 'owner']

    for (const role of roles) {
      const n = mapOrderNote(makeNoteRow({ author_role: role }))

      expect(n.authorRole).toBe(role)
    }
  })

  it('длинный content сохраняется целиком', () => {
    const longContent = 'Клиент просил позвонить за 30 минут. Адрес нестандартный — нужно уточнить у диспетчера.'
    const n = mapOrderNote(makeNoteRow({ content: longContent }))

    expect(n.content).toBe(longContent)
  })
})
