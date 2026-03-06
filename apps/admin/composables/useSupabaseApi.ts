import type { SupabaseClient } from '@supabase/supabase-js'
import { useNuxtApp } from '#imports'
import { branchesApi } from '~/utils/api/branches'
import { categoriesApi } from '~/utils/api/categories'
import { dishesApi } from '~/utils/api/dishes'
import { ordersApi } from '~/utils/api/orders'
import { orderNotesApi } from '~/utils/api/order-notes'
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

  // TODO: может для всех сущностей вынести функции в отдельный файл? А то какие-то отдельно, какие-то тут инлайново
  return {
    branches: bindAll(branchesApi, sb),
    categories: bindAll(categoriesApi, sb),
    dishes: bindAll(dishesApi, sb),
    orders: bindAll(ordersApi, sb),
    orderNotes: bindAll(orderNotesApi, sb),
    orderStatuses: bindAll(orderStatusesApi, sb),
    members: bindAll(membersApi, sb),
    invitations: bindAll(invitationsApi, sb),
    tenants: bindAll(tenantsApi, sb),
    auth: {
      signIn: (email: string, password: string) => sb.auth.signInWithPassword({ email, password }),
      signUp: (email: string, password: string, options?: { data?: Record<string, unknown>; emailRedirectTo?: string }) => sb.auth.signUp({ email, password, options }),
      signOut: () => sb.auth.signOut(),
      getSession: () => sb.auth.getSession(),
      updateUser: (attrs: { password?: string; data?: Record<string, unknown> }) => sb.auth.updateUser(attrs),
    },
    functions: {
      listTeam: (body: object) => sb.functions.invoke('list-team', { body }),
      inviteMember: (body: object) => sb.functions.invoke('invite-member', { body }),
      acceptInvite: (body: object) => sb.functions.invoke('accept-invite', { body }),
      getInvite: (body: object) => sb.functions.invoke('get-invite', { body }),
    },
  }
}
