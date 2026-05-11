import type { SupabaseClient } from '@supabase/supabase-js'
import { useNuxtApp } from '#imports'
import { branchesApi } from '~/features/branches'
import { categoriesApi } from '~/features/menu'
import { dishesApi } from '~/features/menu'
import { ordersApi } from '~/features/orders'
import { orderNotesApi } from '~/features/orders'
import { orderEventsApi } from '~/features/orders'
import { orderStatusesApi } from '~/features/orders'
import { membersApi } from '~/features/team'
import { invitationsApi } from '~/features/team'
import { tenantsApi } from '~/shared/data/api/tenants'
import { authApi } from '~/features/auth'
import { functionsApi } from '~/shared/data/api/functions'
import { modifiersApi } from '~/features/menu'
import { realtimeApi } from '~/shared/data/api/realtime'
import { deliveryZonesApi } from '~/features/orders'
import { combosApi } from '~/features/menu'
import { promoCodesApi } from '~/features/promotions'
import { promotionsApi } from '~/features/promotions'
import { addonsApi } from '~/features/menu'
import { tablesApi } from '~/features/tables'
import { tableCallTypesApi, tableCallsApi } from '~/features/tables'
import { plansApi, billingApi } from '~/features/billing'
import { moduleConfigsApi } from '~/features/settings'
import { kitchenQueueApi } from '~/features/kitchen'
import { reservationsApi } from '~/features/reservations'
import { reservationSettingsApi } from '~/features/reservations'
import { bannersApi } from '~/features/content'
import { galleriesApi } from '~/features/content'
import { tagsApi } from '~/features/catalog'
import { rolesApi } from '~/features/team'
import { supportApi } from '~/features/support'
import { auditLogsApi } from '~/features/audit-log'
import {
  appointmentsApi,
  visitsApi,
  appointmentSettingsApi,
  appointmentEventsApi,
  resourcesApi,
  resourceUnavailabilityApi,
  scheduleTemplatesApi,
} from '~/features/appointments'
import { servicesApi } from '~/features/services-catalog'

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
    resourceUnavailability: bindAll(resourceUnavailabilityApi, sb),
    scheduleTemplates: bindAll(scheduleTemplatesApi, sb),
  }
}
