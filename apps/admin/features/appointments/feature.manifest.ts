import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'appointments',
  vertical: 'services',
  purpose: 'Онлайн-запись: таймлайн, история визитов, исполнители, объекты, шаблоны расписаний, события',
  // Не отдельный TenantModule — гейтится через TenantModules.services + permissions
  tenantModule: false,

  routes: [
    { path: '/appointments/timeline', purpose: 'Главный таймлайн исполнителей с записями' },
    { path: '/appointments/list', purpose: 'Inbox: входящие заявки + история' },
    { path: '/appointments/staff', purpose: 'Исполнители (resources) + их компетенции, расписания' },
    { path: '/appointments/objects', purpose: 'Объекты (комнаты/столы/площадки), где проходят визиты' },
    { path: '/appointments/templates', purpose: 'Шаблоны недельных расписаний' },
    { path: '/appointments/settings', purpose: 'Шаг слотов, буферы, авто-подтверждение, лимиты' },
  ],

  permissions: [
    'appointments.view',
    'appointments.view_all',
    'appointments.view_own',
    'appointments.manage',
  ],

  db: {
    tables: [
      'appointments',
      'appointment_events',
      'appointment_groups',
      'appointment_settings',
      'resources',
      'resource_branches',
      'resource_categories',
      'resource_schedules',
      'resource_date_overrides',
      'resource_disabled_slots',
      'resource_date_disabled_slots',
      'resource_unavailability',
      'schedule_templates',
      'schedule_template_days',
      'service_resources',
    ],
    rpc: [
      'create_appointment',
      'create_appointments_bulk',
      'update_appointment',
      'move_appointment',
      'move_visit_to_date',
      'convert_visit_request',
      'split_visit_to_request',
      'add_service_to_visit',
      'apply_shift_template_to_resource',
      'apply_weekly_template_to_resource',
      'schedule_templates_update',
      'resources_set_branch_ids',
      'resources_set_category_ids',
      'resources_set_service_ids',
    ],
  },

  realtime: [
    { table: 'appointments', channelComposable: 'useAppointmentsChannel', events: ['insert', 'update', 'delete'] },
    { table: 'appointments', channelComposable: 'useVisitsChannel', events: ['insert', 'update', 'delete'] },
    { table: 'appointment_events', channelComposable: 'useAppointmentEvents', events: ['insert'] },
  ],

  dependsOn: [
    'shared.data.useDatabase',
    'shared.data.useRealtimeList',
    'shared.data.useRealtimeWatch',
    'shared.stores.tenant',
    'shared.stores.branch',
    'shared.utils.query',
    'features.services-catalog',
    '@fastio/shared',
  ],
})
