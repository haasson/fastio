import { describe, it, expect } from 'vitest'
import type { AppointmentEvent } from '../types/appointment'
import {
  mapAppointmentEvent,
  formatAppointmentEventText,
  formatAppointmentFieldValue,
  extractAppointmentFieldChanges,
  getAppointmentEventActorFallback,
  APPOINTMENT_STATUS_LABELS,
} from '../utils/appointmentEvents'

const makeEventRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'evt-1',
  appointment_id: 'appt-1',
  tenant_id: 'tenant-1',
  actor_id: 'user-1',
  actor_name: 'Мария',
  actor_role: 'admin',
  event_type: 'appointment_created',
  meta: { source: 'admin' },
  created_at: '2026-03-15T10:00:00Z',
  ...overrides,
})

const makeEvent = (overrides: Partial<AppointmentEvent> = {}): AppointmentEvent => ({
  id: 'evt-1',
  appointmentId: 'appt-1',
  tenantId: 'tenant-1',
  actorId: 'user-1',
  actorName: 'Мария',
  actorRole: 'admin',
  eventType: 'appointment_created',
  meta: { source: 'admin' },
  createdAt: '2026-03-15T10:00:00Z',
  ...overrides,
})

describe('mapAppointmentEvent', () => {
  it('маппит все базовые поля', () => {
    const e = mapAppointmentEvent(makeEventRow())

    expect(e.id).toBe('evt-1')
    expect(e.appointmentId).toBe('appt-1')
    expect(e.tenantId).toBe('tenant-1')
    expect(e.actorId).toBe('user-1')
    expect(e.actorName).toBe('Мария')
    expect(e.actorRole).toBe('admin')
    expect(e.eventType).toBe('appointment_created')
    expect(e.createdAt).toBe('2026-03-15T10:00:00Z')
  })

  it('actor_id null → null', () => {
    const e = mapAppointmentEvent(makeEventRow({ actor_id: null }))

    expect(e.actorId).toBeNull()
  })

  it('meta null → пустой объект', () => {
    const e = mapAppointmentEvent(makeEventRow({ meta: null }))

    expect(e.meta).toEqual({})
  })

  it('meta объект — маппится', () => {
    const e = mapAppointmentEvent(makeEventRow({ meta: { source: 'storefront', service_name: 'Стрижка' } }))

    expect(e.meta.source).toBe('storefront')
    expect(e.meta.service_name).toBe('Стрижка')
  })
})

describe('APPOINTMENT_STATUS_LABELS', () => {
  it('содержит все 4 статуса', () => {
    expect(Object.keys(APPOINTMENT_STATUS_LABELS)).toHaveLength(4)
    expect(APPOINTMENT_STATUS_LABELS.new).toBe('Новая')
    expect(APPOINTMENT_STATUS_LABELS.confirmed).toBe('Подтверждена')
    expect(APPOINTMENT_STATUS_LABELS.done).toBe('Завершена')
    expect(APPOINTMENT_STATUS_LABELS.cancelled).toBe('Отменена')
  })
})

describe('formatAppointmentEventText', () => {
  it('appointment_created из admin → "Запись создана"', () => {
    const e = makeEvent({ eventType: 'appointment_created', meta: { source: 'admin' } })

    expect(formatAppointmentEventText(e)).toBe('Запись создана')
  })

  it('appointment_created из storefront → содержит "клиентом через сайт"', () => {
    const e = makeEvent({ eventType: 'appointment_created', meta: { source: 'storefront' } })

    expect(formatAppointmentEventText(e)).toContain('клиентом через сайт')
  })

  it('appointment_created с service_name → добавляет имя услуги', () => {
    const e = makeEvent({ eventType: 'appointment_created', meta: { source: 'admin', service_name: 'Стрижка' } })

    expect(formatAppointmentEventText(e)).toContain('Стрижка')
  })

  it('status_changed → текст с стрелочкой', () => {
    const e = makeEvent({
      eventType: 'status_changed',
      meta: { from: 'new', to: 'confirmed' },
    })
    const text = formatAppointmentEventText(e)

    expect(text).toContain('Новая')
    expect(text).toContain('Подтверждена')
    expect(text).toContain('→')
  })

  it('extended → содержит количество минут', () => {
    const e = makeEvent({ eventType: 'extended', meta: { minutes: 30 } })

    expect(formatAppointmentEventText(e)).toContain('30')
  })

  it('closed_now → "Закрыта сейчас"', () => {
    const e = makeEvent({ eventType: 'closed_now', meta: {} })

    expect(formatAppointmentEventText(e)).toBe('Закрыта сейчас')
  })

  it('неизвестный тип → возвращает сам тип', () => {
    const e = makeEvent({ eventType: 'some_custom_event' as any, meta: {} })

    expect(formatAppointmentEventText(e)).toBe('some_custom_event')
  })
})

describe('formatAppointmentFieldValue', () => {
  const noop = (s: string) => s

  it('null → "—"', () => {
    expect(formatAppointmentFieldValue('customer_name', null, noop)).toBe('—')
  })

  it('undefined → "—"', () => {
    expect(formatAppointmentFieldValue('customer_name', undefined, noop)).toBe('—')
  })

  it('пустая строка → "—"', () => {
    expect(formatAppointmentFieldValue('customer_name', '', noop)).toBe('—')
  })

  it('строковое значение → возвращается как строка', () => {
    expect(formatAppointmentFieldValue('customer_name', 'Иван', noop)).toBe('Иван')
  })

  it('starts_at → вызывает formatDate', () => {
    const formatDate = (s: string) => `FORMATTED:${s}`

    expect(formatAppointmentFieldValue('starts_at', '2026-03-15T10:00:00Z', formatDate)).toBe('FORMATTED:2026-03-15T10:00:00Z')
  })

  it('ends_at → вызывает formatDate', () => {
    const formatDate = (s: string) => `FORMATTED:${s}`

    expect(formatAppointmentFieldValue('ends_at', '2026-03-15T11:00:00Z', formatDate)).toBe('FORMATTED:2026-03-15T11:00:00Z')
  })
})

describe('getAppointmentEventActorFallback', () => {
  it('appointment_created от storefront → "Клиент"', () => {
    const e = makeEvent({ eventType: 'appointment_created', meta: { source: 'storefront' } })

    expect(getAppointmentEventActorFallback(e)).toBe('Клиент')
  })

  it('appointment_created от admin → "Система"', () => {
    const e = makeEvent({ eventType: 'appointment_created', meta: { source: 'admin' } })

    expect(getAppointmentEventActorFallback(e)).toBe('Система')
  })

  it('другой event_type → "Система"', () => {
    const e = makeEvent({ eventType: 'status_changed', meta: {} })

    expect(getAppointmentEventActorFallback(e)).toBe('Система')
  })
})

describe('extractAppointmentFieldChanges', () => {
  const noop = (s: string) => s

  it('пустой meta.changes → пустой массив', () => {
    const e = makeEvent({ eventType: 'field_changed', meta: { changes: [] } })

    expect(extractAppointmentFieldChanges(e, noop)).toEqual([])
  })

  it('meta без changes → пустой массив', () => {
    const e = makeEvent({ eventType: 'field_changed', meta: {} })

    expect(extractAppointmentFieldChanges(e, noop)).toEqual([])
  })

  it('изменение customer_name — правильно маппится', () => {
    const e = makeEvent({
      eventType: 'field_changed',
      meta: {
        changes: [{ field: 'customer_name', old_value: 'Иван', new_value: 'Пётр' }],
      },
    })
    const changes = extractAppointmentFieldChanges(e, noop)

    expect(changes).toHaveLength(1)
    expect(changes[0].label).toBe('Имя клиента')
    expect(changes[0].oldFormatted).toBe('Иван')
    expect(changes[0].newFormatted).toBe('Пётр')
  })

  it('неизвестное поле → использует имя поля как label', () => {
    const e = makeEvent({
      eventType: 'field_changed',
      meta: {
        changes: [{ field: 'some_unknown_field', old_value: 'x', new_value: 'y' }],
      },
    })
    const changes = extractAppointmentFieldChanges(e, noop)

    expect(changes[0].label).toBe('some_unknown_field')
  })

  it('несколько изменений — все маппятся', () => {
    const e = makeEvent({
      eventType: 'field_changed',
      meta: {
        changes: [
          { field: 'customer_name', old_value: 'Иван', new_value: 'Пётр' },
          { field: 'customer_phone', old_value: '79991234567', new_value: '79007654321' },
        ],
      },
    })
    const changes = extractAppointmentFieldChanges(e, noop)

    expect(changes).toHaveLength(2)
  })
})
