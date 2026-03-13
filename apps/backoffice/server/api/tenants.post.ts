import { defineEventHandler, createError, readBody } from 'h3'
import { useRuntimeConfig } from '#imports'
import { getAdminClient } from '../utils/adminClient'

type CreateTenantBody = {
  name: string
  slug: string
  email: string
}

export default defineEventHandler(async (event) => {
  const { name, slug, email } = await readBody<CreateTenantBody>(event)

  if (!name?.trim() || !slug?.trim() || !email?.trim()) {
    throw createError({ statusCode: 400, message: 'Заполни все поля: name, slug, email' })
  }

  const supabase = getAdminClient()

  // 1. Ищем или создаём пользователя
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()

  if (listError) throw createError({ statusCode: 500, message: listError.message })

  let userId: string
  const existing = users.find((u) => u.email === email)

  if (existing) {
    userId = existing.id
  } else {
    const config = useRuntimeConfig()
    const appUrl = config.public.supabaseUrl.includes('127.0.0.1')
      ? 'http://localhost:4710'
      : 'https://app.fastio.ru'

    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${appUrl}/login`,
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

  // 3. Создаём тенант
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
        plan: 'basic',
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        renewsAt: null,
      },
      delivery_min_order: 500,
      delivery_fee: 150,
    })
    .select('id, name, slug')
    .single()

  if (tenantError) throw createError({ statusCode: 500, message: tenantError.message })

  // 4. Добавляем owner в tenant_members
  const { error: memberError } = await supabase
    .from('tenant_members')
    .insert({ tenant_id: tenant.id, user_id: userId, role: 'owner' })

  if (memberError) throw createError({ statusCode: 500, message: memberError.message })

  return tenant
})
