import type { SupabaseClient } from '@supabase/supabase-js'
import type { Resource, ResourceSchedule, ResourceDisabledSlot } from '@fastio/shared'
import {
  mapResource, mapResourceSchedule, mapResourceDisabledSlot,
  mapResourceDateOverride, mapResourceDateDisabledSlot,
  addDaysToDateStr,
} from '@fastio/shared'
import type { ResourceDateOverride, ResourceDateDisabledSlot } from '@fastio/shared'
import type {
  ResourceRow,
  ResourceScheduleRow, ResourceDisabledSlotRow,
  ResourceDateOverrideRow, ResourceDateDisabledSlotRow,
  ServiceResourceRow, ResourceCategoryRow, ResourceBranchRow,
  ScheduleTemplateRow, ScheduleTemplateDayRow,
  AppointmentRow,
} from '~/utils/api/db-types'
import { query } from '~/utils/query'

// ─── Bulk-load для availability/presence composables ─────
//
// `useResourcePresence` (плашки working/off-hours) и `useGroupSlotSearch`
// (поиск слотов в админ-редакторе) грузят до 10 разных таблиц одной пачкой
// через эти бандлы вместо прямых `sb.from(...)`.

export type AvailabilityBundle = {
  serviceResources: ServiceResourceRow[]
  resourceCategories: ResourceCategoryRow[]
  schedules: ResourceScheduleRow[]
  disabledSlots: ResourceDisabledSlotRow[]
  dateOverrides: ResourceDateOverrideRow[]
  dateDisabledSlots: ResourceDateDisabledSlotRow[]
  appointments: Pick<AppointmentRow, 'id' | 'resource_id' | 'starts_at' | 'ends_at' | 'actual_ends_at'>[]
  branchLinks: ResourceBranchRow[]
  shiftTemplates: Pick<ScheduleTemplateRow, 'id' | 'cycle_length'>[]
  shiftTemplateDays: ScheduleTemplateDayRow[]
}

export type PresenceBundle = {
  schedules: ResourceScheduleRow[]
  dateOverrides: ResourceDateOverrideRow[]
  branchLinks: ResourceBranchRow[]
  shiftTemplates: Pick<ScheduleTemplateRow, 'id' | 'cycle_length'>[]
  shiftTemplateDays: ScheduleTemplateDayRow[]
}

const RESOURCE_FIELDS = 'id, tenant_id, name, type, member_id, capacity, is_active, sort_order, applied_template_id, cycle_start_date, created_at, updated_at'

export type ResourceFormData = {
  name: string
  type: 'person' | 'object'
  memberId?: string | null
  capacity?: number
  isActive?: boolean
  sortOrder?: number
}

export const resourcesApi = {
  async list(sb: SupabaseClient, tenantId: string): Promise<Resource[]> {
    const data = await query(
      sb.from('resources').select(RESOURCE_FIELDS).eq('tenant_id', tenantId).order('sort_order').order('name'),
    )

    return (data ?? []).map((r) => mapResource(r as unknown as ResourceRow))
  },

  /**
   * Лёгкий запрос только `member_id` ресурса — для view_own access-check без
   * тягания всего списка ресурсов на одну страницу. Возвращает `null` если
   * ресурс не найден или у него нет привязки к мемберу (объект, не сотрудник).
   */
  async getMemberId(sb: SupabaseClient, resourceId: string): Promise<string | null> {
    const { data, error } = await sb
      .from('resources')
      .select('member_id')
      .eq('id', resourceId)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return null

    return (data as { member_id: string | null }).member_id
  },

  /**
   * Ресурсы, привязанные к категории (через resource_categories) + к конкретной
   * услуге напрямую (через service_resources). Используется в дравере услуги.
   */
  async listByCategory(
    sb: SupabaseClient,
    tenantId: string,
    categoryId: string,
    serviceId?: string,
  ): Promise<Resource[]> {
    const [catRes, svcRes] = await Promise.all([
      sb.from('resource_categories').select('resource_id').eq('category_id', categoryId),
      serviceId
        ? sb.from('service_resources').select('resource_id').eq('service_id', serviceId)
        : Promise.resolve({ data: [] }),
    ])

    const ids = [
      ...((catRes.data ?? []) as { resource_id: string }[]).map((r) => r.resource_id),
      ...((svcRes.data ?? []) as { resource_id: string }[]).map((r) => r.resource_id),
    ]
    const unique = [...new Set(ids)]

    if (unique.length === 0) return []

    const data = await query(
      sb.from('resources')
        .select(RESOURCE_FIELDS)
        .in('id', unique)
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('sort_order')
        .order('name'),
    )

    return (data ?? []).map((r) => mapResource(r as unknown as ResourceRow))
  },

  async countActiveByType(sb: SupabaseClient, tenantId: string): Promise<{ person: number; object: number }> {
    const [{ count: personCount }, { count: objectCount }] = await Promise.all([
      sb.from('resources').select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId).eq('is_active', true).eq('type', 'person'),
      sb.from('resources').select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId).eq('is_active', true).eq('type', 'object'),
    ])

    return { person: personCount ?? 0, object: objectCount ?? 0 }
  },

  async create(sb: SupabaseClient, tenantId: string, form: ResourceFormData): Promise<Resource> {
    const result = await query(
      sb.from('resources').insert({
        tenant_id: tenantId,
        name: form.name,
        type: form.type,
        member_id: form.memberId ?? null,
        capacity: form.capacity ?? 1,
        is_active: form.isActive ?? true,
        sort_order: form.sortOrder ?? 0,
      }).select(RESOURCE_FIELDS).single(),
    )

    return mapResource(result as unknown as ResourceRow)
  },

  async update(sb: SupabaseClient, id: string, form: Partial<ResourceFormData>): Promise<Resource> {
    const patch: Record<string, unknown> = {}

    if (form.name !== undefined) patch.name = form.name
    if (form.type !== undefined) patch.type = form.type
    if (form.memberId !== undefined) patch.member_id = form.memberId
    if (form.capacity !== undefined) patch.capacity = form.capacity
    if (form.isActive !== undefined) patch.is_active = form.isActive
    if (form.sortOrder !== undefined) patch.sort_order = form.sortOrder

    const result = await query(
      sb.from('resources').update(patch).eq('id', id).select(RESOURCE_FIELDS).single(),
    )

    return mapResource(result as unknown as ResourceRow)
  },

  /**
   * Удаляет ресурс. Бросает ошибку, если на ресурс уже есть записи —
   * пользователь должен сначала их отменить или перенести.
   */
  async remove(sb: SupabaseClient, id: string): Promise<void> {
    const { count } = await sb
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('resource_id', id)
      .not('status', 'eq', 'cancelled')

    if ((count ?? 0) > 0) {
      throw new Error(`Невозможно удалить: ${count} активных записей. Отмените их и попробуйте снова.`)
    }
    await query(sb.from('resources').delete().eq('id', id))
  },

  /**
   * Массовое обновление sort_order по списку id (порядок в массиве = порядок).
   */
  async setOrder(sb: SupabaseClient, ids: string[]): Promise<void> {
    await Promise.all(
      ids.map((id, idx) => query(sb.from('resources').update({ sort_order: idx }).eq('id', id))),
    )
  },

  // ─── Resource ↔ Branch ───────────────────────────────────

  async getBranchIds(sb: SupabaseClient, resourceId: string): Promise<string[]> {
    const { data } = await sb.from('resource_branches').select('branch_id').eq('resource_id', resourceId)

    return (data ?? []).map((r) => r.branch_id as string)
  },

  async setBranchIds(sb: SupabaseClient, resourceId: string, branchIds: string[]): Promise<void> {
    await query(
      sb.rpc('resources_set_branch_ids', {
        p_resource_id: resourceId,
        p_branch_ids: branchIds,
      }),
    )
  },

  // ─── Resource ↔ Service ─────────────────────────────────

  /**
   * Batch-загрузка явных компетенций (`service_resources`) и категорий
   * (`resource_categories`) для списка ресурсов. Используется когда нужно
   * показать «какой мастер умеет какую услугу» без полного `bulkLoadAvailability`
   * (например — фильтр селекта мастера в редакторе группы записи до выбора даты).
   */
  async bulkLoadCompetencies(
    sb: SupabaseClient,
    resourceIds: string[],
  ): Promise<{ serviceResources: ServiceResourceRow[]; resourceCategories: ResourceCategoryRow[] }> {
    if (resourceIds.length === 0) {
      return { serviceResources: [], resourceCategories: [] }
    }
    const [explicitRes, categoryRes] = await Promise.all([
      sb.from('service_resources').select('service_id, resource_id').in('resource_id', resourceIds),
      sb.from('resource_categories').select('category_id, resource_id').in('resource_id', resourceIds),
    ])

    return {
      serviceResources: (explicitRes.data ?? []) as ServiceResourceRow[],
      resourceCategories: (categoryRes.data ?? []) as ResourceCategoryRow[],
    }
  },

  async getServiceIds(sb: SupabaseClient, resourceId: string): Promise<string[]> {
    const { data } = await sb.from('service_resources').select('service_id').eq('resource_id', resourceId)

    return (data ?? []).map((r) => r.service_id as string)
  },

  async setServiceIds(sb: SupabaseClient, resourceId: string, serviceIds: string[]): Promise<void> {
    await query(
      sb.rpc('resources_set_service_ids', {
        p_resource_id: resourceId,
        p_service_ids: serviceIds,
      }),
    )
  },

  // ─── Resource ↔ Category (auto-assign по всей категории) ─

  async getCategoryIds(sb: SupabaseClient, resourceId: string): Promise<string[]> {
    const { data } = await sb.from('resource_categories').select('category_id').eq('resource_id', resourceId)

    return (data ?? []).map((r) => r.category_id as string)
  },

  async setCategoryIds(sb: SupabaseClient, resourceId: string, categoryIds: string[]): Promise<void> {
    await query(
      sb.rpc('resources_set_category_ids', {
        p_resource_id: resourceId,
        p_category_ids: categoryIds,
      }),
    )
  },

  // ─── Schedules ────────────────────────────────────────────

  async getSchedules(sb: SupabaseClient, resourceId: string): Promise<ResourceSchedule[]> {
    const { data } = await sb.from('resource_schedules').select('*').eq('resource_id', resourceId).order('day_of_week')

    return (data ?? []).map((r) => mapResourceSchedule(r as unknown as ResourceScheduleRow))
  },

  async upsertSchedule(
    sb: SupabaseClient,
    resourceId: string,
    dayOfWeek: number,
    isWorking: boolean,
    openTime: string | null,
    closeTime: string | null,
  ): Promise<void> {
    await query(
      sb.from('resource_schedules').upsert({
        resource_id: resourceId,
        day_of_week: dayOfWeek,
        is_working: isWorking,
        open_time: openTime,
        close_time: closeTime,
      }, { onConflict: 'resource_id,day_of_week' }),
    )
  },

  async getDisabledSlots(sb: SupabaseClient, resourceId: string): Promise<ResourceDisabledSlot[]> {
    const { data } = await sb.from('resource_disabled_slots').select('*').eq('resource_id', resourceId)

    return (data ?? []).map((r) => mapResourceDisabledSlot(r as unknown as ResourceDisabledSlotRow))
  },

  async toggleDisabledSlot(
    sb: SupabaseClient,
    resourceId: string,
    dayOfWeek: number,
    slotTime: string,
    disabled: boolean,
  ): Promise<void> {
    if (disabled) {
      await query(
        sb.from('resource_disabled_slots').insert({ resource_id: resourceId, day_of_week: dayOfWeek, slot_time: slotTime }),
      )
    } else {
      await query(
        sb.from('resource_disabled_slots')
          .delete()
          .eq('resource_id', resourceId)
          .eq('day_of_week', dayOfWeek)
          .eq('slot_time', slotTime),
      )
    }
  },

  async getDateOverrides(sb: SupabaseClient, resourceId: string): Promise<ResourceDateOverride[]> {
    const { data } = await sb.from('resource_date_overrides').select('*').eq('resource_id', resourceId).order('date')

    return (data ?? []).map((r) => mapResourceDateOverride(r as unknown as ResourceDateOverrideRow))
  },

  async getDateOverridesRange(
    sb: SupabaseClient,
    resourceId: string,
    fromDate: string,
    toDate: string,
  ): Promise<ResourceDateOverride[]> {
    const { data } = await sb.from('resource_date_overrides').select('*')
      .eq('resource_id', resourceId)
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date')

    return (data ?? []).map((r) => mapResourceDateOverride(r as unknown as ResourceDateOverrideRow))
  },

  async getDateDisabledSlotsRange(
    sb: SupabaseClient,
    resourceId: string,
    fromDate: string,
    toDate: string,
  ): Promise<ResourceDateDisabledSlot[]> {
    const { data } = await sb.from('resource_date_disabled_slots').select('*')
      .eq('resource_id', resourceId)
      .gte('date', fromDate)
      .lte('date', toDate)

    return (data ?? []).map((r) => mapResourceDateDisabledSlot(r as unknown as ResourceDateDisabledSlotRow))
  },

  async upsertDateOverride(
    sb: SupabaseClient,
    resourceId: string,
    date: string,
    isWorking: boolean,
    openTime: string | null,
    closeTime: string | null,
  ): Promise<void> {
    await query(
      sb.from('resource_date_overrides').upsert({
        resource_id: resourceId,
        date,
        is_working: isWorking,
        open_time: openTime,
        close_time: closeTime,
      }, { onConflict: 'resource_id,date' }),
    )
  },

  async removeDateOverride(sb: SupabaseClient, resourceId: string, date: string): Promise<void> {
    await query(sb.from('resource_date_overrides').delete().eq('resource_id', resourceId).eq('date', date))
  },

  async getDateDisabledSlots(sb: SupabaseClient, resourceId: string, date: string): Promise<ResourceDateDisabledSlot[]> {
    const { data } = await sb.from('resource_date_disabled_slots').select('*').eq('resource_id', resourceId).eq('date', date)

    return (data ?? []).map((r) => mapResourceDateDisabledSlot(r as unknown as ResourceDateDisabledSlotRow))
  },

  async generateShiftSchedule(
    sb: SupabaseClient,
    resourceId: string,
    params: {
      startDate: string
      workDays: number
      offDays: number
      openTime: string
      closeTime: string
      untilDate: string
    },
  ): Promise<void> {
    const { startDate, workDays, offDays, openTime, closeTime, untilDate } = params
    const cycleLen = workDays + offDays
    const rows: { resource_id: string; date: string; is_working: boolean; open_time: string | null; close_time: string | null }[] = []

    let cursor = startDate
    let dayInCycle = 0

    while (cursor <= untilDate) {
      const isWorking = dayInCycle < workDays

      rows.push({
        resource_id: resourceId,
        date: cursor,
        is_working: isWorking,
        open_time: isWorking ? openTime : null,
        close_time: isWorking ? closeTime : null,
      })
      dayInCycle = (dayInCycle + 1) % cycleLen
      cursor = addDaysToDateStr(cursor, 1)
    }

    // Batch upsert in chunks of 200
    for (let i = 0; i < rows.length; i += 200) {
      await query(
        sb.from('resource_date_overrides').upsert(rows.slice(i, i + 200), { onConflict: 'resource_id,date' }),
      )
    }
  },

  /**
   * Загружает одной пачкой все данные расписания/занятости/компетенций
   * для списка ресурсов на конкретную дату.
   */
  async bulkLoadAvailability(
    sb: SupabaseClient,
    params: {
      tenantId: string
      resourceIds: string[]
      date: string
      dayStartUtc: string
      dayEndUtc: string
      shiftTemplateIds: string[]
    },
  ): Promise<AvailabilityBundle> {
    const { tenantId, resourceIds, dayStartUtc, dayEndUtc, date, shiftTemplateIds } = params

    if (resourceIds.length === 0) {
      return {
        serviceResources: [], resourceCategories: [], schedules: [],
        disabledSlots: [], dateOverrides: [], dateDisabledSlots: [],
        appointments: [], branchLinks: [], shiftTemplates: [], shiftTemplateDays: [],
      }
    }

    const [
      explicitRes,
      categoryRes,
      schedulesRes,
      disabledRes,
      overridesRes,
      dateDisabledRes,
      appointmentsRes,
      branchLinksRes,
      shiftTemplatesRes,
      shiftTemplateDaysRes,
    ] = await Promise.all([
      sb.from('service_resources').select('service_id, resource_id').in('resource_id', resourceIds),
      sb.from('resource_categories').select('category_id, resource_id').in('resource_id', resourceIds),
      sb.from('resource_schedules').select('*').in('resource_id', resourceIds),
      sb.from('resource_disabled_slots').select('*').in('resource_id', resourceIds),
      sb.from('resource_date_overrides').select('*').in('resource_id', resourceIds).eq('date', date),
      sb.from('resource_date_disabled_slots').select('*').in('resource_id', resourceIds).eq('date', date),
      // Расширяем нижнюю границу на сутки назад: запись, начавшаяся вчера в 23:30
      // и заканчивающаяся сегодня в 01:30, должна попасть в выборку, иначе слот
      // 00:00–01:30 будет ошибочно показан как свободный.
      sb.from('appointments').select('id, resource_id, starts_at, ends_at, actual_ends_at')
        .eq('tenant_id', tenantId)
        .gte('starts_at', new Date(new Date(dayStartUtc).getTime() - 86_400_000).toISOString())
        .lt('starts_at', dayEndUtc)
        .is('deleted_at', null)
        .not('status', 'eq', 'cancelled'),
      sb.from('resource_branches').select('resource_id, branch_id').in('resource_id', resourceIds),
      shiftTemplateIds.length
        ? sb.from('schedule_templates').select('id, cycle_length').in('id', shiftTemplateIds)
        : Promise.resolve({ data: [] as Pick<ScheduleTemplateRow, 'id' | 'cycle_length'>[] }),
      shiftTemplateIds.length
        ? sb.from('schedule_template_days').select('template_id, day_index, is_working, open_time, close_time').in('template_id', shiftTemplateIds)
        : Promise.resolve({ data: [] as ScheduleTemplateDayRow[] }),
    ])

    return {
      serviceResources: (explicitRes.data ?? []) as ServiceResourceRow[],
      resourceCategories: (categoryRes.data ?? []) as ResourceCategoryRow[],
      schedules: (schedulesRes.data ?? []) as ResourceScheduleRow[],
      disabledSlots: (disabledRes.data ?? []) as ResourceDisabledSlotRow[],
      dateOverrides: (overridesRes.data ?? []) as ResourceDateOverrideRow[],
      dateDisabledSlots: (dateDisabledRes.data ?? []) as ResourceDateDisabledSlotRow[],
      appointments: (appointmentsRes.data ?? []) as Pick<AppointmentRow, 'id' | 'resource_id' | 'starts_at' | 'ends_at' | 'actual_ends_at'>[],
      branchLinks: (branchLinksRes.data ?? []) as ResourceBranchRow[],
      shiftTemplates: (shiftTemplatesRes.data ?? []) as Pick<ScheduleTemplateRow, 'id' | 'cycle_length'>[],
      shiftTemplateDays: (shiftTemplateDaysRes.data ?? []) as ScheduleTemplateDayRow[],
    }
  },

  /**
   * Загружает данные для расчёта текущего рабочего статуса ресурсов
   * (`working` / `off-hours` / `absent` / `hidden`) — используется
   * в `useResourcePresence` для плашек на списке staff/objects.
   */
  async bulkLoadPresence(
    sb: SupabaseClient,
    params: {
      resourceIds: string[]
      todayDate: string
      shiftTemplateIds: string[]
    },
  ): Promise<PresenceBundle> {
    const { resourceIds, todayDate, shiftTemplateIds } = params

    if (resourceIds.length === 0) {
      return { schedules: [], dateOverrides: [], branchLinks: [], shiftTemplates: [], shiftTemplateDays: [] }
    }

    const [schedulesRes, overridesRes, branchLinksRes, shiftTemplatesRes, shiftDaysRes] = await Promise.all([
      sb.from('resource_schedules').select('*').in('resource_id', resourceIds),
      sb.from('resource_date_overrides').select('*').in('resource_id', resourceIds)
        .gte('date', todayDate).order('date', { ascending: true }),
      sb.from('resource_branches').select('resource_id, branch_id').in('resource_id', resourceIds),
      shiftTemplateIds.length
        ? sb.from('schedule_templates').select('id, cycle_length').in('id', shiftTemplateIds)
        : Promise.resolve({ data: [] as Pick<ScheduleTemplateRow, 'id' | 'cycle_length'>[] }),
      shiftTemplateIds.length
        ? sb.from('schedule_template_days').select('template_id, day_index, is_working, open_time, close_time').in('template_id', shiftTemplateIds)
        : Promise.resolve({ data: [] as ScheduleTemplateDayRow[] }),
    ])

    return {
      schedules: (schedulesRes.data ?? []) as ResourceScheduleRow[],
      dateOverrides: (overridesRes.data ?? []) as ResourceDateOverrideRow[],
      branchLinks: (branchLinksRes.data ?? []) as ResourceBranchRow[],
      shiftTemplates: (shiftTemplatesRes.data ?? []) as Pick<ScheduleTemplateRow, 'id' | 'cycle_length'>[],
      shiftTemplateDays: (shiftDaysRes.data ?? []) as ScheduleTemplateDayRow[],
    }
  },
}
