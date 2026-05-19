import { describe, it, expect } from 'vitest'
import { supportStatusMap } from '../supportStatus'

describe('supportStatusMap', () => {
  it('open → тип warning и правильный лейбл', () => {
    expect(supportStatusMap.open.type).toBe('warning')
    expect(supportStatusMap.open.label).toBe('Открыт')
  })

  it('waiting_for_reply → тип primary', () => {
    expect(supportStatusMap.waiting_for_reply.type).toBe('primary')
    expect(supportStatusMap.waiting_for_reply.label).toBe('Ожидает ответа')
  })

  it('resolved → тип default и лейбл "Закрыт"', () => {
    expect(supportStatusMap.resolved.type).toBe('default')
    expect(supportStatusMap.resolved.label).toBe('Закрыт')
  })

  it('map содержит ровно 3 статуса', () => {
    expect(Object.keys(supportStatusMap)).toHaveLength(3)
  })

  it('все статусы имеют поле type и label', () => {
    for (const [, val] of Object.entries(supportStatusMap)) {
      expect(val).toHaveProperty('type')
      expect(val).toHaveProperty('label')
      expect(typeof val.label).toBe('string')
      expect(val.label.length).toBeGreaterThan(0)
    }
  })
})
