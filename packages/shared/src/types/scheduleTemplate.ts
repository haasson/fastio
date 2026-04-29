export type ScheduleTemplateType = 'weekly' | 'shift'

export type ScheduleTemplate = {
  id: string
  tenantId: string
  name: string
  type: ScheduleTemplateType
  // shift only
  cycleLength: number | null
  // null → первый филиал тенанта
  referenceBranchId: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type ScheduleTemplateSlot = {
  templateId: string
  dayIndex: number     // 0..6 для weekly, 0..cycleLength-1 для shift
  slotTime: string     // "HH:MM"
}

export type ScheduleTemplateFull = ScheduleTemplate & {
  slots: ScheduleTemplateSlot[]
}

export type ScheduleTemplateFormData = {
  name: string
  type: ScheduleTemplateType
  cycleLength: number | null
  referenceBranchId: string | null
  slots: ScheduleTemplateSlot[]
}
