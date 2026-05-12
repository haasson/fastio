import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'appointments',
  vertical: 'services',
  purpose: 'Запись на услуги: booking-flow с витрины (выбор слота → подтверждение → success) и кабинет записей гостя',

  routes: [
    { path: '/appointments', purpose: 'Главная страница booking-flow для services-tenant\'ов' },
    { path: '/appointments/cart', purpose: 'Корзина выбранных услуг (multi-service appointment)' },
    { path: '/appointments/checkout', purpose: 'Финальный шаг booking-flow (контакты + submit)' },
    { path: '/account/appointments', purpose: 'Кабинет: история записей гостя (отмена/детали)' },
  ],

  db: {
    // Через Nitro endpoints: /api/appointments/* (request, slots, group-slots, group-week,
    // resources, services, settings, remind-offer, remind-token, bulk).
    // И /api/customer/appointments + /api/customer/appointments/[id]/cancel.
    tables: [],
  },

  dependsOn: [
    'features.services-catalog',        // useServicesStore для lookup
    'features.cart',                    // ServiceCartItem на чекауте
    'features.branch',                  // выбранный филиал → фильтр resources/services
    'features.auth',                    // Telegram-логин для напоминаний
    'shared.composables.useToast',
    '@fastio/shared',                   // type Appointment, AppointmentStatus, Visit
    'server.api.appointments',
    'server.api.appointments.group-slots',
    'server.api.appointments.group-week',
    'server.api.appointments.request',
    'server.api.appointments.bulk',
    'server.api.appointments.remind-offer',
    'server.api.customer.appointments',
  ],
})
