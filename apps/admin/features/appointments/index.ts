// Public barrel of the appointments module.

// API
export * from './api/appointments'
export * from './api/appointment-events'
export * from './api/appointment-settings'
export * from './api/visits'
export * from './api/resources'
export * from './api/resource-unavailability'
export * from './api/schedule-templates'

// Composables
export * from './composables/useAppointmentEditorState'
export * from './composables/useAppointmentEventLogger'
export * from './composables/useAppointmentEvents'
export * from './composables/useAppointmentInboxCounter'
export * from './composables/useAppointmentInboxHandler'
export * from './composables/useAppointmentViewScope'
export * from './composables/useAppointmentsChannel'
export * from './composables/useEditorCompetencies'
export * from './composables/useGroupSlotSearch'
export * from './composables/useInboxTableColumns'
export * from './composables/useResourcePresence'
export * from './composables/useScheduleConflictCheck'
export * from './composables/useStaffMonthSchedule'
export * from './composables/useTimelineMoveBlocker'
export * from './composables/useVisitAggregate'
export * from './composables/useVisitsChannel'
export * from './composables/useVisitsList'

// Utils
export * from './utils/scheduleConflictCheck'
export * from './utils/timelineAvailability'

// Stores
export { useAppointmentSettingsStore } from './stores/appointmentSettings'

// timeline/ и appointmentEditor/ — внутренние подпапки, НЕ ре-экспортятся через barrel.
// Если что-то из них нужно снаружи — поднять конкретный экспорт сюда.
