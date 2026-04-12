import { describe, it, expect } from 'vitest'
import { getAllowedStatuses } from '../order-status-helpers'
import type { OrderStatus } from '../types/order'

const makeStatus = (id: string, groupType: 'new' | 'in_progress' | 'completed' | 'cancelled'): OrderStatus => ({
  id,
  tenantId: 't1',
  name: id,
  groupType,
  position: 0,
  quickActions: [],
})

const statuses: OrderStatus[] = [
  makeStatus('s-new', 'new'),
  makeStatus('s-new-2', 'new'),
  makeStatus('s-progress', 'in_progress'),
  makeStatus('s-progress-2', 'in_progress'),
  makeStatus('s-done', 'completed'),
  makeStatus('s-cancelled', 'cancelled'),
]

describe('getAllowedStatuses', () => {
  it('from new — all groups allowed', () => {
    const result = getAllowedStatuses('new', statuses)
    expect(result.map((s) => s.id)).toEqual(['s-new', 's-new-2', 's-progress', 's-progress-2', 's-done', 's-cancelled'])
  })

  it('from in_progress — no new group', () => {
    const result = getAllowedStatuses('in_progress', statuses)
    const groups = new Set(result.map((s) => s.groupType))
    expect(groups).not.toContain('new')
    expect(groups).toContain('in_progress')
    expect(groups).toContain('completed')
    expect(groups).toContain('cancelled')
  })

  it('from completed — empty (terminal)', () => {
    expect(getAllowedStatuses('completed', statuses)).toEqual([])
  })

  it('from cancelled — empty (terminal)', () => {
    expect(getAllowedStatuses('cancelled', statuses)).toEqual([])
  })
})
