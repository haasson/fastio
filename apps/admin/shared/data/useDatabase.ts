import type { SupabaseClient } from '@supabase/supabase-js'
import { useNuxtApp } from '#imports'
// Прямые импорты из ~/features/<X>/api/<Y>, а не через barrel ~/features/<X>,
// чтобы не тянуть composables модуля (большинство которых вызывает useDatabase
// и образовало бы циклическую зависимость useDatabase ↔ barrel ↔ composable).
// useDatabase.ts — в AGGREGATOR_FILES (см. eslint.config.mjs), поэтому
// no-restricted-imports на deep-path сюда не применяется.
import { tenantsApi } from '~/shared/data/api/tenants'
import { functionsApi } from '~/shared/data/api/functions'
import { proxyImageApi } from '~/shared/data/api/proxy-image'
import { realtimeApi } from '~/shared/data/api/realtime'
import { appointmentEventsApi } from '~/features/appointments/api/appointment-events'
import { appointmentSettingsApi } from '~/features/appointments/api/appointment-settings'
import { appointmentsApi } from '~/features/appointments/api/appointments'
import { resourceUnavailabilityApi } from '~/features/appointments/api/resource-unavailability'
import { resourcesApi } from '~/features/appointments/api/resources'
import { scheduleTemplatesApi } from '~/features/appointments/api/schedule-templates'
import { visitsApi } from '~/features/appointments/api/visits'
import { auditLogsApi } from '~/features/audit-log/api/audit-logs'
import { journalApi } from '~/features/audit-log/api/journal'
import { authApi } from '~/features/auth/api/auth'
import { billingApi } from '~/features/billing/api/billing'
import { plansApi } from '~/features/billing/api/plans'
import { branchesApi } from '~/features/branches/api/branches'
import { tagsApi } from '~/features/catalog/api/tags'
import { bannersApi } from '~/features/content/api/banners'
import { galleriesApi } from '~/features/content/api/galleries'
import { kitchenQueueApi } from '~/features/kitchen/api/kitchen-queue'
import { addonsApi } from '~/features/menu/api/addons'
import { categoriesApi } from '~/features/menu/api/categories'
import { combosApi } from '~/features/menu/api/combos'
import { dishesApi } from '~/features/menu/api/dishes'
import { modifiersApi } from '~/features/menu/api/modifiers'
import { deliveryZonesApi } from '~/features/orders/api/delivery-zones'
import { orderEventsApi } from '~/features/orders/api/order-events'
import { orderNotesApi } from '~/features/orders/api/order-notes'
import { orderStatusesApi } from '~/features/orders/api/order-statuses'
import { ordersApi } from '~/features/orders/api/orders'
import { promoCodesApi } from '~/features/promotions/api/promo-codes'
import { promotionsApi } from '~/features/promotions/api/promotions'
import { reservationSettingsApi } from '~/features/reservations/api/reservation-settings'
import { reservationsApi } from '~/features/reservations/api/reservations'
import { servicesApi } from '~/features/services-catalog/api/services'
import { moduleConfigsApi } from '~/features/settings/api/module-configs'
import { telegramLinkApi } from '~/features/settings/api/telegram-link'
import { supportApi } from '~/features/support/api/support'
import { tableCallsApi, tableCallTypesApi } from '~/features/tables/api/table-calls'
import { tablesApi } from '~/features/tables/api/tables'
import { tableSettingsApi } from '~/features/tables/api/table-settings'
import { invitationsApi } from '~/features/team/api/invitations'
import { membersApi } from '~/features/team/api/members'
import { rolesApi } from '~/features/team/api/roles'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiModule = Record<string, (sb: SupabaseClient, ...args: any[]) => any>

type BoundApi<T extends ApiModule> = {
  [K in keyof T]: T[K] extends (sb: SupabaseClient, ...args: infer A) => infer R
    ? (...args: A) => R
    : never
}

const bindAll = <T extends ApiModule>(api: T, sb: SupabaseClient): BoundApi<T> => Object.fromEntries(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Object.entries(api).map(([k, fn]) => [k, (...args: any[]) => fn(sb, ...args)]),
) as BoundApi<T>

export const useDatabase = () => {
  const { $supabase: sb } = useNuxtApp()

  return {
    realtime: bindAll(realtimeApi, sb),
    branches: bindAll(branchesApi, sb),
    categories: bindAll(categoriesApi, sb),
    dishes: bindAll(dishesApi, sb),
    orders: bindAll(ordersApi, sb),
    orderNotes: bindAll(orderNotesApi, sb),
    orderEvents: bindAll(orderEventsApi, sb),
    orderStatuses: bindAll(orderStatusesApi, sb),
    members: bindAll(membersApi, sb),
    invitations: bindAll(invitationsApi, sb),
    tenants: bindAll(tenantsApi, sb),
    auth: bindAll(authApi, sb),
    functions: bindAll(functionsApi, sb),
    proxyImage: bindAll(proxyImageApi, sb),
    modifiers: bindAll(modifiersApi, sb),
    deliveryZones: bindAll(deliveryZonesApi, sb),
    combos: bindAll(combosApi, sb),
    promoCodes: bindAll(promoCodesApi, sb),
    promotions: bindAll(promotionsApi, sb),
    addons: bindAll(addonsApi, sb),
    tables: bindAll(tablesApi, sb),
    tableCallTypes: bindAll(tableCallTypesApi, sb),
    tableCalls: bindAll(tableCallsApi, sb),
    tableSettings: bindAll(tableSettingsApi, sb),
    plans: bindAll(plansApi, sb),
    billing: bindAll(billingApi, sb),
    moduleConfigs: bindAll(moduleConfigsApi, sb),
    telegramLink: bindAll(telegramLinkApi, sb),
    kitchenQueue: bindAll(kitchenQueueApi, sb),
    reservations: bindAll(reservationsApi, sb),
    reservationSettings: bindAll(reservationSettingsApi, sb),
    banners: bindAll(bannersApi, sb),
    galleries: bindAll(galleriesApi, sb),
    tags: bindAll(tagsApi, sb),
    roles: bindAll(rolesApi, sb),
    support: bindAll(supportApi, sb),
    auditLogs: bindAll(auditLogsApi, sb),
    journal: bindAll(journalApi, sb),
    appointments: bindAll(appointmentsApi, sb),
    visits: bindAll(visitsApi, sb),
    appointmentSettings: bindAll(appointmentSettingsApi, sb),
    appointmentEvents: bindAll(appointmentEventsApi, sb),
    services: bindAll(servicesApi, sb),
    resources: bindAll(resourcesApi, sb),
    resourceUnavailability: bindAll(resourceUnavailabilityApi, sb),
    scheduleTemplates: bindAll(scheduleTemplatesApi, sb),
  }
}
