import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import type { Appointment, AppointmentSettings, Resource } from '@fastio/shared'
import type { TimelineAvailability } from '~/utils/timelineAvailability'
import { useTimelineMoveBlocker } from '../data/useTimelineMoveBlocker'

const TZ = 'Europe/Moscow'
const DATE = '2026-05-06'

// 06.05.2026 09:00 локального МСК → ISO в UTC
const iso = (hh: string): string => new Date(`${DATE}T${hh}:00+03:00`).toISOString()

const baseAppt: Appointment = {
  id: 'appt-1',
  tenantId: 't1',
  branchId: null,
  groupId: null,
  serviceId: 'svc-1',
  serviceName: 'Стрижка',
  servicePrice: 1000,
  resourceId: 'res-1',
  userId: null,
  customerId: null,
  customerName: 'Иван',
  customerPhone: '+79991234567',
  startsAt: iso('10:00'),
  endsAt: iso('11:00'),
  actualEndsAt: null,
  bookingMode: 'fixed',
  status: 'confirmed',
  resourceAssignedBy: 'admin',
  notes: null,
  cancelReason: null,
  cancelledBy: null,
  cancelledAt: null,
  confirmedAt: null,
  confirmedBy: null,
  createdAt: iso('09:00'),
  updatedAt: iso('09:00'),
}

const baseResource = {
  id: 'res-1',
  tenantId: 't1',
  type: 'person',
  name: 'Мастер 1',
  memberId: null,
  isActive: true,
  capacity: 1,
  appliedTemplateId: null,
  cycleStartDate: null,
  workingHoursSchedule: null,
  sortOrder: 0,
  createdAt: iso('00:00'),
  updatedAt: iso('00:00'),
} as unknown as Resource

const buildBlocker = (overrides: Partial<{
  availability: TimelineAvailability
  resources: Resource[]
  appointments: Appointment[]
  selectedDate: string
  todayStr: string
  now: number
  competencyByResource: Map<string, Set<string>>
}> = {}) => {
  const settings: AppointmentSettings = { slotStepMinutes: 30 } as AppointmentSettings

  return useTimelineMoveBlocker({
    availability: ref(overrides.availability ?? {
      'res-1': { workingHours: { openTime: '09:00', closeTime: '18:00' }, disabledSlots: [] },
      'res-2': { workingHours: { openTime: '09:00', closeTime: '18:00' }, disabledSlots: [] },
    }),
    resources: ref(overrides.resources ?? [
      baseResource,
      { ...baseResource, id: 'res-2', name: 'Мастер 2' },
    ]),
    appointments: ref(overrides.appointments ?? [baseAppt]),
    settings: ref(settings),
    selectedDate: ref(overrides.selectedDate ?? DATE),
    todayStr: ref(overrides.todayStr ?? '2026-05-07'),
    now: ref(overrides.now ?? new Date(`${DATE}T08:00:00+03:00`).getTime()),
    tz: ref(TZ),
    competencyByResource: ref(overrides.competencyByResource ?? new Map([
      ['res-1', new Set(['svc-1'])],
      ['res-2', new Set(['svc-1'])],
    ])),
  })
}

describe('useTimelineMoveBlocker', () => {
  it('drop в то же место — null (нет блокировки)', () => {
    const { getMoveBlocker } = buildBlocker()

    expect(getMoveBlocker({ appt: baseAppt, dyMin: 0, newResourceId: 'res-1' })).toBeNull()
  })

  it('drop в свободный слот того же мастера — null', () => {
    const { getMoveBlocker } = buildBlocker()

    // +60 минут → 11:00–12:00, никем не занято
    expect(getMoveBlocker({ appt: baseAppt, dyMin: 60, newResourceId: 'res-1' })).toBeNull()
  })

  it('drop на другого мастера со свободным окном — null', () => {
    const { getMoveBlocker } = buildBlocker()

    expect(getMoveBlocker({ appt: baseAppt, dyMin: 0, newResourceId: 'res-2' })).toBeNull()
  })

  it('drop в прошлое (selectedDate=today, новое время раньше now) — "В прошлое нельзя"', () => {
    const { getMoveBlocker } = buildBlocker({
      todayStr: DATE, // selectedDate=today
      now: new Date(`${DATE}T12:00:00+03:00`).getTime(), // сейчас 12:00
    })

    // dyMin=-180 → 07:00–08:00 (до now=12:00)
    expect(getMoveBlocker({ appt: baseAppt, dyMin: -180, newResourceId: 'res-1' })).toBe('В прошлое нельзя')
  })

  it('мастер не имеет рабочих часов в этот день — "Мастер не работает"', () => {
    const { getMoveBlocker } = buildBlocker({
      availability: {
        'res-1': { workingHours: { openTime: '09:00', closeTime: '18:00' }, disabledSlots: [] },
        'res-2': { workingHours: null, disabledSlots: [] },
      },
    })

    expect(getMoveBlocker({ appt: baseAppt, dyMin: 0, newResourceId: 'res-2' })).toBe('Мастер не работает')
  })

  it('новое время выходит за рабочие часы — "Вне рабочих часов"', () => {
    const { getMoveBlocker } = buildBlocker()

    // Окно 09:00–18:00. dyMin=+540 → старт 19:00 — за пределами
    expect(getMoveBlocker({ appt: baseAppt, dyMin: 540, newResourceId: 'res-1' })).toBe('Вне рабочих часов')
  })

  it('новое время попадает на disabled-слот — "Нерабочий слот"', () => {
    const { getMoveBlocker } = buildBlocker({
      availability: {
        'res-1': { workingHours: { openTime: '09:00', closeTime: '18:00' }, disabledSlots: ['11:00'] },
      },
    })

    // dyMin=+60 → старт 11:00, попадает в disabled 11:00
    expect(getMoveBlocker({ appt: baseAppt, dyMin: 60, newResourceId: 'res-1' })).toBe('Нерабочий слот')
  })

  it('целевой мастер не умеет услугу — "Нет компетенции"', () => {
    const { getMoveBlocker } = buildBlocker({
      competencyByResource: new Map([
        ['res-1', new Set(['svc-1'])],
        ['res-2', new Set(['svc-other'])],
      ]),
    })

    expect(getMoveBlocker({ appt: baseAppt, dyMin: 0, newResourceId: 'res-2' })).toBe('Нет компетенции')
  })

  it('целевой слот занят другой записью — "Слот занят" (capacity=1)', () => {
    const conflicting: Appointment = {
      ...baseAppt,
      id: 'appt-2',
      resourceId: 'res-2',
      startsAt: iso('10:30'),
      endsAt: iso('11:30'),
    }
    const { getMoveBlocker } = buildBlocker({
      appointments: [baseAppt, conflicting],
    })

    // Перенести appt-1 на res-2 в то же время — пересекается с appt-2
    expect(getMoveBlocker({ appt: baseAppt, dyMin: 0, newResourceId: 'res-2' })).toBe('Слот занят')
  })

  it('capacity > 1 разрешает несколько одновременных записей', () => {
    const conflicting: Appointment = {
      ...baseAppt,
      id: 'appt-2',
      resourceId: 'res-2',
      startsAt: iso('10:30'),
      endsAt: iso('11:30'),
    }
    const { getMoveBlocker } = buildBlocker({
      resources: [
        baseResource,
        { ...baseResource, id: 'res-2', capacity: 2 },
      ],
      appointments: [baseAppt, conflicting],
    })

    expect(getMoveBlocker({ appt: baseAppt, dyMin: 0, newResourceId: 'res-2' })).toBeNull()
  })

  it('cancelled-запись не считается за конфликт (выбывает из подсчёта)', () => {
    const cancelled: Appointment = {
      ...baseAppt,
      id: 'appt-2',
      resourceId: 'res-2',
      startsAt: iso('10:30'),
      endsAt: iso('11:30'),
      status: 'cancelled',
    }
    const { getMoveBlocker } = buildBlocker({
      appointments: [baseAppt, cancelled],
    })

    expect(getMoveBlocker({ appt: baseAppt, dyMin: 0, newResourceId: 'res-2' })).toBeNull()
  })

  it('порядок: время в прошлом проверяется ДО рабочих часов', () => {
    const { getMoveBlocker } = buildBlocker({
      todayStr: DATE,
      now: new Date(`${DATE}T20:00:00+03:00`).getTime(),
      availability: { 'res-1': { workingHours: null, disabledSlots: [] } },
    })

    // Окно 09:00, время прошло (20:00 уже now). Должно быть "В прошлое нельзя",
    // а не "Мастер не работает".
    expect(getMoveBlocker({ appt: baseAppt, dyMin: 0, newResourceId: 'res-1' })).toBe('В прошлое нельзя')
  })
})
