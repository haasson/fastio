import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ScheduleTemplate,
  ScheduleTemplateDay,
  ScheduleTemplateFull,
  ScheduleTemplateFormData,
} from '@fastio/shared'
import {
  mapScheduleTemplate,
  mapScheduleTemplateDay,
} from '@fastio/shared'
import type { ScheduleTemplateRow, ScheduleTemplateDayRow } from '~/utils/api/db-types'
import { query } from '~/shared/utils/query'

const TEMPLATE_FIELDS
  = 'id, tenant_id, name, type, cycle_length, reference_branch_id, sort_order, created_at, updated_at'

const writeTemplate = (form: ScheduleTemplateFormData, tenantId: string): Record<string, unknown> => ({
  tenant_id: tenantId,
  name: form.name,
  type: form.type,
  cycle_length: form.type === 'shift' ? form.cycleLength : null,
  reference_branch_id: form.referenceBranchId,
})

const getFullImpl = async (sb: SupabaseClient, templateId: string): Promise<ScheduleTemplateFull | null> => {
  const tplData = await query(
    sb.from('schedule_templates').select(TEMPLATE_FIELDS).eq('id', templateId).maybeSingle(),
  )

  if (!tplData) return null
  const tpl = mapScheduleTemplate(tplData as unknown as ScheduleTemplateRow)

  const daysData = await query(
    sb.from('schedule_template_days').select('*').eq('template_id', templateId).order('day_index'),
  )

  const days: ScheduleTemplateDay[] = (daysData ?? []).map((r) => mapScheduleTemplateDay(r as unknown as ScheduleTemplateDayRow),
  )

  return { ...tpl, days }
}

const writeDays = async (
  sb: SupabaseClient,
  templateId: string,
  days: ScheduleTemplateDay[],
): Promise<void> => {
  if (days.length === 0) return
  await query(
    sb.from('schedule_template_days').insert(
      days.map((d) => ({
        template_id: templateId,
        day_index: d.dayIndex,
        is_working: d.isWorking,
        open_time: d.openTime,
        close_time: d.closeTime,
      })),
    ),
  )
}

export const scheduleTemplatesApi = {
  async list(sb: SupabaseClient, tenantId: string): Promise<ScheduleTemplate[]> {
    const data = await query(
      sb.from('schedule_templates').select(TEMPLATE_FIELDS).eq('tenant_id', tenantId).order('sort_order').order('name'),
    )

    return (data ?? []).map((r) => mapScheduleTemplate(r as unknown as ScheduleTemplateRow))
  },

  /**
   * Список ресурсов, к которым в данный момент привязан этот шаблон.
   * Используется для информативного сообщения при попытке удалить.
   */
  async resourcesUsingTemplate(sb: SupabaseClient, templateId: string): Promise<{ id: string; name: string }[]> {
    const data = await query(
      sb.from('resources').select('id, name').eq('applied_template_id', templateId).order('name'),
    )

    return (data ?? []) as { id: string; name: string }[]
  },

  getFull: getFullImpl,

  async create(sb: SupabaseClient, tenantId: string, form: ScheduleTemplateFormData): Promise<ScheduleTemplate> {
    const result = await query(
      sb.from('schedule_templates').insert(writeTemplate(form, tenantId)).select(TEMPLATE_FIELDS).single(),
    )
    const tpl = mapScheduleTemplate(result as unknown as ScheduleTemplateRow)

    await writeDays(sb, tpl.id, form.days)

    return tpl
  },

  async update(sb: SupabaseClient, id: string, _tenantId: string, form: ScheduleTemplateFormData): Promise<ScheduleTemplate> {
    // Atomic: update template fields + replace days in one transaction.
    await query(
      sb.rpc('schedule_templates_update', {
        p_id: id,
        p_name: form.name,
        p_type: form.type,
        p_cycle_length: form.type === 'shift' ? form.cycleLength : null,
        p_reference_branch_id: form.referenceBranchId,
        p_days: form.days.map((d) => ({
          day_index: d.dayIndex,
          is_working: d.isWorking,
          open_time: d.openTime,
          close_time: d.closeTime,
        })),
      }),
    )

    const refreshed = await query(
      sb.from('schedule_templates').select(TEMPLATE_FIELDS).eq('id', id).single(),
    )

    return mapScheduleTemplate(refreshed as unknown as ScheduleTemplateRow)
  },

  /**
   * Удаляет шаблон. Если он применён к каким-то ресурсам — бросает ошибку
   * со списком имён, чтобы юзер понял что отвязать.
   */
  async remove(sb: SupabaseClient, id: string): Promise<void> {
    const linked = await query(
      sb.from('resources').select('name').eq('applied_template_id', id).order('name'),
    )

    if ((linked ?? []).length > 0) {
      const names = (linked ?? []).map((r) => r.name as string).join(', ')

      throw new Error(`Шаблон применён к: ${names}. Сначала смените график у этих исполнителей.`)
    }
    await query(sb.from('schedule_templates').delete().eq('id', id))
  },

  /**
   * Массовое обновление sort_order по списку id.
   */
  async setOrder(sb: SupabaseClient, ids: string[]): Promise<void> {
    await Promise.all(
      ids.map((id, idx) => query(sb.from('schedule_templates').update({ sort_order: idx }).eq('id', id))),
    )
  },

  /**
   * Применяет weekly-шаблон к ресурсу. RPC копирует часы шаблона 1:1 в
   * resource_schedules (без обрезки по часам филиала и без disabled_slots).
   */
  async applyWeeklyToResource(sb: SupabaseClient, templateId: string, resourceId: string): Promise<void> {
    await query(
      sb.rpc('apply_weekly_template_to_resource', {
        p_resource_id: resourceId,
        p_template_id: templateId,
      }),
    )
  },

  /**
   * Привязывает shift-шаблон к ресурсу с анкером startDate (день 1 цикла).
   * Расписание считается лениво из schedule_template_days по cycleStartDate.
   */
  async applyShiftToResource(
    sb: SupabaseClient,
    templateId: string,
    resourceId: string,
    range: { startDate: string },
  ): Promise<void> {
    const tpl = await getFullImpl(sb, templateId)

    if (!tpl || tpl.type !== 'shift' || !tpl.cycleLength) {
      throw new Error('Template not found or invalid shift template')
    }

    await query(
      sb.rpc('apply_shift_template_to_resource', {
        p_resource_id: resourceId,
        p_template_id: templateId,
        p_cycle_start_date: range.startDate,
      }),
    )
  },
}
