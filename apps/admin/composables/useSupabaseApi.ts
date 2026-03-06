import type { SupabaseClient } from '@supabase/supabase-js'
import { useNuxtApp } from '#imports'
import { branchesApi } from '~/utils/api/branches'
import { categoriesApi } from '~/utils/api/categories'
import { dishesApi } from '~/utils/api/dishes'
import { ordersApi } from '~/utils/api/orders'
import { orderStatusesApi } from '~/utils/api/order-statuses'
import { membersApi } from '~/utils/api/members'
import { invitationsApi } from '~/utils/api/invitations'
import { tenantsApi } from '~/utils/api/tenants'

type ApiModule = Record<string, (sb: SupabaseClient, ...args: any[]) => any>

type BoundApi<T extends ApiModule> = {
  [K in keyof T]: T[K] extends (sb: SupabaseClient, ...args: infer A) => infer R
    ? (...args: A) => R
    : never
}

const bindAll = <T extends ApiModule>(api: T, sb: SupabaseClient): BoundApi<T> => Object.fromEntries(
  Object.entries(api).map(([k, fn]) => [k, (...args: any[]) => fn(sb, ...args)]),
) as BoundApi<T>

export const useSupabaseApi = () => {
  const { $supabase: sb } = useNuxtApp()

  return {
    branches: bindAll(branchesApi, sb),
    categories: bindAll(categoriesApi, sb),
    dishes: bindAll(dishesApi, sb),
    orders: bindAll(ordersApi, sb),
    orderStatuses: bindAll(orderStatusesApi, sb),
    members: bindAll(membersApi, sb),
    invitations: bindAll(invitationsApi, sb),
    tenants: bindAll(tenantsApi, sb),
    functions: {
      listTeam: (body: object) => sb.functions.invoke('list-team', { body }),
      inviteMember: (body: object) => sb.functions.invoke('invite-member', { body }),
    },
  }
}
