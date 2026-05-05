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

/**
 * Один день шаблона: рабочий или выходной + часы (open/close).
 * close < open означает overnight (закрытие следующего календарного дня).
 *
 * Для weekly шаблона dayIndex = 0..6 (0 = воскресенье в JS-конвенции),
 * для shift шаблона dayIndex = 0..cycleLength-1.
 *
 * Слоты внутри окна вычисляются на runtime из (open, close, slotStep).
 */
export type ScheduleTemplateDay = {
  templateId: string
  dayIndex: number
  isWorking: boolean
  openTime: string | null   // "HH:MM" или null если isWorking=false
  closeTime: string | null  // "HH:MM" или null если isWorking=false. close < open ⇒ overnight
}

export type ScheduleTemplateFull = ScheduleTemplate & {
  days: ScheduleTemplateDay[]
}

export type ScheduleTemplateFormData = {
  name: string
  type: ScheduleTemplateType
  cycleLength: number | null
  referenceBranchId: string | null
  days: ScheduleTemplateDay[]
}
