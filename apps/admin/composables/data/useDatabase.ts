import type { SupabaseClient } from '@supabase/supabase-js'
import { useNuxtApp } from '#imports'
import { branchesApi } from '~/utils/api/branches'
import { categoriesApi } from '~/utils/api/categories'
import { dishesApi } from '~/utils/api/dishes'
import { ordersApi } from '~/utils/api/orders'
import { orderNotesApi } from '~/utils/api/order-notes'
import { orderEventsApi } from '~/utils/api/order-events'
import { orderStatusesApi } from '~/utils/api/order-statuses'
import { membersApi } from '~/utils/api/members'
import { invitationsApi } from '~/utils/api/invitations'
import { tenantsApi } from '~/utils/api/tenants'
import { authApi } from '~/utils/api/auth'
import { functionsApi } from '~/utils/api/functions'
import { modifiersApi } from '~/utils/api/modifiers'
import { realtimeApi } from '~/utils/api/realtime'
import { deliveryZonesApi } from '~/utils/api/delivery-zones'
import { combosApi } from '~/utils/api/combos'
import { promoCodesApi } from '~/utils/api/promo-codes'
import { promotionsApi } from '~/utils/api/promotions'
import { addonsApi } from '~/utils/api/addons'
import { tablesApi } from '~/utils/api/tables'
import { tableCallTypesApi, tableCallsApi } from '~/utils/api/table-calls'
import { plansApi } from '~/utils/api/plans'
import { billingApi } from '~/utils/api/billing'
import { moduleConfigsApi } from '~/utils/api/module-configs'
import { kitchenQueueApi } from '~/utils/api/kitchen-queue'
import { reservationsApi } from '~/utils/api/reservations'
import { reservationSettingsApi } from '~/utils/api/reservation-settings'
import { bannersApi } from '~/utils/api/banners'
import { galleriesApi } from '~/utils/api/galleries'
import { tagsApi } from '~/utils/api/tags'
import { rolesApi } from '~/utils/api/roles'
import { supportApi } from '~/utils/api/support'
import { auditLogsApi } from '~/utils/api/audit-logs'
import { appointmentsApi } from '~/utils/api/appointments'
import { visitsApi } from '~/utils/api/visits'
import { appointmentSettingsApi } from '~/utils/api/appointment-settings'
import { appointmentEventsApi } from '~/utils/api/appointment-events'
import { servicesApi } from '~/utils/api/services'
import { resourcesApi } from '~/utils/api/resources'
import { scheduleTemplatesApi } from '~/utils/api/schedule-templates'

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
    modifiers: bindAll(modifiersApi, sb),
    deliveryZones: bindAll(deliveryZonesApi, sb),
    combos: bindAll(combosApi, sb),
    promoCodes: bindAll(promoCodesApi, sb),
    promotions: bindAll(promotionsApi, sb),
    addons: bindAll(addonsApi, sb),
    tables: bindAll(tablesApi, sb),
    tableCallTypes: bindAll(tableCallTypesApi, sb),
    tableCalls: bindAll(tableCallsApi, sb),
    plans: bindAll(plansApi, sb),
    billing: bindAll(billingApi, sb),
    moduleConfigs: bindAll(moduleConfigsApi, sb),
    kitchenQueue: bindAll(kitchenQueueApi, sb),
    reservations: bindAll(reservationsApi, sb),
    reservationSettings: bindAll(reservationSettingsApi, sb),
    banners: bindAll(bannersApi, sb),
    galleries: bindAll(galleriesApi, sb),
    tags: bindAll(tagsApi, sb),
    roles: bindAll(rolesApi, sb),
    support: bindAll(supportApi, sb),
    auditLogs: bindAll(auditLogsApi, sb),
    appointments: bindAll(appointmentsApi, sb),
    visits: bindAll(visitsApi, sb),
    appointmentSettings: bindAll(appointmentSettingsApi, sb),
    appointmentEvents: bindAll(appointmentEventsApi, sb),
    services: bindAll(servicesApi, sb),
    resources: bindAll(resourcesApi, sb),
    scheduleTemplates: bindAll(scheduleTemplatesApi, sb),
  }
}
