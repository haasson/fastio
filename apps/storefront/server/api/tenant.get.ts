import type { Tenant } from '@fastio/shared'

export default defineEventHandler((event) => event.context.tenant as Tenant)
