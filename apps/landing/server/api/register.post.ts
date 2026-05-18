import { defineEventHandler, createError, readBody } from 'h3'
import { useRuntimeConfig } from '#imports'
import { createRateLimiter } from '@fastio/shared'
import { getAdminClient } from '../utils/adminClient'
import { getClientIp } from '../utils/clientIp'

type RegisterBody = {
  name?: string
  slug?: string
  email?: string
  website?: string // honeypot — бот скорее всего заполнит
  initial_plan_key?: string
}

const SLUG_MAX_LENGTH = 63
// In-memory limiter: рассчитан на single-instance деплой.
// При репликации заменить на Supabase-backed (таблица rate_limits) или Redis.
const rateLimiter = createRateLimiter(5, 60 * 60 * 1000)

class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

function validateInput(body: RegisterBody) {
  const name = body.name?.trim()
  const slug = body.slug?.trim()
  const email = body.email?.trim()

  if (!name || !slug || !email) throw new ValidationError('Заполни все поля')
  if (name.length > 120) throw new ValidationError('Слишком длинное название')
  const normalizedSlug = slug.toLowerCase()
  if (normalizedSlug.length > SLUG_MAX_LENGTH) throw new ValidationError('Слишком длинный адрес')
  if (!/^[a-z0-9-]+$/.test(normalizedSlug)) throw new ValidationError('Адрес может содержать только латинские буквы, цифры и дефис')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ValidationError('Некорректный email')
  if (email.length > 254) throw new ValidationError('Слишком длинный email')

  return { name, slug: normalizedSlug, email }
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const ip = getClientIp(event)

  if (!rateLimiter.check(ip)) {
    throw createError({ statusCode: 429, message: 'Слишком много попыток регистрации. Попробуйте позже.' })
  }

  const body = await readBody<RegisterBody>(event)

  if (body.website) {
    throw createError({ statusCode: 400, message: 'Invalid request' })
  }

  let name: string, slug: string, email: string

  try {
    ({ name, slug, email } = validateInput(body))
  } catch (err) {
    if (err instanceof ValidationError) {
      throw createError({ statusCode: 400, message: err.message })
    }
    throw err
  }

  const supabase = getAdminClient()

  // 1. Ищем пользователя по email (RPC вместо listUsers, чтобы не тянуть всех юзеров).
  const { data: existingUserId, error: lookupError } = await supabase.rpc('get_user_id_by_email', { p_email: email })

  if (lookupError) throw createError({ statusCode: 500, message: lookupError.message })

  let userId: string
  let isNewUser = false
  // Zombie-юзер: auth.user уже есть, но email_confirmed_at пуст — пароль не установлен.
  // Возникает если первое invite-письмо потеряли/проигнорировали, а сейчас регистрируем второе заведение.
  // Без resend recovery таких юзеров не пустит в админку — login требует пароль, которого нет.
  let isPendingActivation = false

  if (existingUserId) {
    userId = existingUserId as string

    const { data: existing } = await supabase.auth.admin.getUserById(userId)

    if (existing?.user && !existing.user.email_confirmed_at) {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${config.adminUrl}/set-password`,
      })
      if (resetError) {
        console.error('[register] resetPasswordForEmail failed for pending user', { email, err: resetError })
      } else {
        isPendingActivation = true
      }
    }
  } else {
    isNewUser = true
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${config.adminUrl}/set-password`,
    })

    if (error) {
      // Race: параллельный запрос уже создал юзера между get_user_id_by_email и inviteUserByEmail.
      const isDuplicate = error.code === 'email_exists' || /already (been )?registered|already exists/i.test(error.message)

      if (!isDuplicate) throw createError({ statusCode: 500, message: error.message })

      const { data: raceUserId } = await supabase.rpc('get_user_id_by_email', { p_email: email })

      if (!raceUserId) throw createError({ statusCode: 500, message: error.message })

      userId = raceUserId as string
      isNewUser = false
    } else {
      userId = data.user.id
    }
  }

  // 2. trial_days из billing_config + валидация initial_plan_key.
  const [{ data: billingConfig }, { data: planRow }] = await Promise.all([
    supabase.from('billing_config').select('trial_days').single(),
    body.initial_plan_key && /^[a-z0-9-]+$/.test(body.initial_plan_key)
      ? supabase.from('plans').select('key').eq('key', body.initial_plan_key).eq('is_active', true).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const trialDays = billingConfig?.trial_days ?? 14
  const initialPlan = planRow?.key ?? 'retail-showcase'

  // 3. Создаём тенант + tenant_members одной транзакцией через RPC.
  const { data: tenantId, error: rpcError } = await supabase.rpc('self_register_tenant', {
    p_owner_id: userId,
    p_name: name,
    p_slug: slug,
    p_email: email,
    p_trial_days: trialDays,
    p_initial_plan: initialPlan,
  })

  if (rpcError) {
    // Компенсация: если мы только что создали юзера — откатываем, чтобы не оставлять висячий auth.users.
    if (isNewUser) {
      await supabase.auth.admin.deleteUser(userId).catch((err) => {
        console.error('[register] failed to rollback auth user', userId, err)
      })
    }

    // 23505 = unique_violation. В нашем случае — конкуренция за slug.
    if (rpcError.code === '23505') {
      throw createError({ statusCode: 409, message: `Адрес «${slug}» уже занят` })
    }

    throw createError({ statusCode: 500, message: rpcError.message })
  }

  // 4. Уведомляем существующего активированного пользователя о новом заведении (fire-and-forget).
  // pending — юзер уже получил recovery-ссылку выше, второе письмо «у вас новое заведение» только запутает.
  if (!isNewUser && !isPendingActivation) {
    supabase.functions
      .invoke('send-new-tenant-email', {
        body: { email, tenantName: name, adminUrl: config.adminUrl },
        headers: { 'x-fastio-internal-token': config.fastioInternalToken },
      })
      .catch((err) => console.error('[register] send-new-tenant-email failed', { tenantId, email, err }))
  }

  return { ok: true }
})
