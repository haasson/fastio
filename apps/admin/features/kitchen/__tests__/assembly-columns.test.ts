import { describe, it, expect } from 'vitest'
import type { KitchenQueueItem, KitchenQueueStatus } from '@fastio/shared'
import { getOrderPhase, getAssemblyColumn } from '@fastio/shared'

// getOrderPhase читает только status + skipKitchen — остальное не важно.
const item = (status: KitchenQueueStatus, skipKitchen = false): KitchenQueueItem => ({ status, skipKitchen } as KitchenQueueItem)

describe('getOrderPhase', () => {
  it('cooking — есть незавершённые кухонные блюда', () => {
    expect(getOrderPhase([item('queued'), item('done')])).toBe('cooking')
    expect(getOrderPhase([item('in_progress')])).toBe('cooking')
  })

  it('collecting — кухня готова, осталась несобранная некухонная позиция', () => {
    expect(getOrderPhase([item('done'), item('queued', true)])).toBe('collecting')
  })

  it('ready — все активные блюда готовы/поданы', () => {
    expect(getOrderPhase([item('done'), item('served', true)])).toBe('ready')
  })

  it('cancelled — активных блюд не осталось', () => {
    expect(getOrderPhase([item('cancelled'), item('cancelled')])).toBe('cancelled')
  })

  it('отменённые блюда не учитываются при расчёте фазы', () => {
    // одно done + одно cancelled → активное только done → ready
    expect(getOrderPhase([item('done'), item('cancelled')])).toBe('ready')
  })
})

describe('getAssemblyColumn — 3 фазы -> 2 рабочие колонки', () => {
  it('cooking -> своя колонка', () => {
    expect(getAssemblyColumn('cooking')).toBe('cooking')
  })

  it('collecting и ready схлопнуты в одну колонку «Готово»', () => {
    expect(getAssemblyColumn('collecting')).toBe('ready')
    expect(getAssemblyColumn('ready')).toBe('ready')
  })

  it('cancelled -> своя колонка', () => {
    expect(getAssemblyColumn('cancelled')).toBe('cancelled')
  })
})
