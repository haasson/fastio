import { describe, it, expect } from 'vitest'
import type { KitchenQueueItem } from '@fastio/shared'
import { isCancelledItemVisible } from '@fastio/shared'

const item = (assignedTo: string | null, dismissedAt: string | null): Pick<KitchenQueueItem, 'assignedTo' | 'dismissedAt'> => ({ assignedTo, dismissedAt })

describe('isCancelledItemVisible', () => {
  it('взято в работу и не убрано → видно (перечёркнуто, ждёт «Убрать»)', () => {
    expect(isCancelledItemVisible(item('cook-1', null))).toBe(true)
  })

  it('ничьё (никто не брал) → не видно, просто исчезает', () => {
    expect(isCancelledItemVisible(item(null, null))).toBe(false)
  })

  it('взято в работу, но уже убрано (dismissed) → не видно', () => {
    expect(isCancelledItemVisible(item('cook-1', '2026-05-30T10:00:00Z'))).toBe(false)
  })

  it('ничьё и убрано → не видно', () => {
    expect(isCancelledItemVisible(item(null, '2026-05-30T10:00:00Z'))).toBe(false)
  })
})
