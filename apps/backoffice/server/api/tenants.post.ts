import { defineEventHandler, createError, readBody } from 'h3'
import { useRuntimeConfig } from '#imports'
import { getAdminClient } from '../utils/adminClient'
import { validateCreateTenantInput } from '../utils/billing'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ name?: string; slug?: string; email?: string }>(event)

  let name: string, slug: string, email: string
  try {
    ({ name, slug, email } = validateCreateTenantInput(body))
  }
  catch (err) {
    throw createError({ statusCode: 400, message: (err as Error).message })
  }

  const supabase = getAdminClient()

  // 1. Ищем или создаём пользователя
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (listError) throw createError({ statusCode: 500, message: listError.message })

  const existing = users.find((u) => u.email?.toLowerCase() === email.toLowerCase())

  let userId: string
  let isNewUser = false

  if (existing) {
    userId = existing.id
  } else {
    isNewUser = true
    const config = useRuntimeConfig()
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${config.adminUrl}/set-password`,
    })
    if (error) throw createError({ statusCode: 500, message: error.message })
    userId = data.user.id
  }

  // 2. Проверяем уникальность slug
  const { data: slugCheck } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (slugCheck) {
    throw createError({ statusCode: 409, message: `Slug "${slug}" уже занят` })
  }

  // 3. Получаем trial_days из billing_config
  const { data: billingConfig } = await supabase
    .from('billing_config')
    .select('trial_days')
    .single()
  const trialDays = billingConfig?.trial_days ?? 14

  // 4. Создаём тенант
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({
      owner_id: userId,
      name,
      slug,
      custom_domain: null,
      theme: {
        primaryColor: '#ff6b35',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        logoUrl: null,
        bannerUrl: null,
        preset: 'default',
      },
      contacts: {
        phone: '',
        email,
        address: '',
        instagram: null,
        vk: null,
        telegram: null,
        whatsapp: null,
      },
      working_hours: 'Пн–Вс 10:00–22:00',
      notifications: { email, telegramChatId: null },
      subscription: {
        status: 'trial',
        plan: 'service',
        trialEndsAt: new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString(),
        renewsAt: null,
      },
      delivery_min_order: 500,
      delivery_fee: 150,
    })
    .select('id, name, slug')
    .single()

  if (tenantError) throw createError({ statusCode: 500, message: tenantError.message })

  // 5. Добавляем owner в tenant_members
  const { error: memberError } = await supabase
    .from('tenant_members')
    .insert({ tenant_id: tenant.id, user_id: userId })

  if (memberError) throw createError({ statusCode: 500, message: memberError.message })

  // 6. Уведомляем существующего пользователя о новом заведении
  if (!isNewUser) {
    const config = useRuntimeConfig()
    supabase.functions.invoke('send-new-tenant-email', {
      body: { email, tenantName: name, adminUrl: config.adminUrl },
    }).catch((err) => console.error('Failed to send new tenant notification:', err))
  }

  return { ...tenant, isNewUser }
})
