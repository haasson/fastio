type TenantSubscription = {
  status: string
  renewsAt?: string | null
  trialEndsAt?: string | null
}

type TenantWithSubscription = {
  id: string
  subscription: TenantSubscription
}

export function filterDueTenants(tenants: TenantWithSubscription[], now: Date): TenantWithSubscription[] {
  return tenants.filter((tenant) => {
    const sub = tenant.subscription
    const renewsAt = sub.renewsAt ? new Date(sub.renewsAt) : null
    const trialEndsAt = sub.trialEndsAt ? new Date(sub.trialEndsAt) : null

    return sub.status === 'past_due'
      || (renewsAt && renewsAt <= now)
      || (sub.status === 'trial' && trialEndsAt && trialEndsAt <= now)
  })
}

export function validateCreateTenantInput(body: { name?: string; slug?: string; email?: string }): {
  name: string
  slug: string
  email: string
} {
  const name = body.name?.trim()
  const slug = body.slug?.trim()
  const email = body.email?.trim()

  if (!name || !slug || !email) {
    throw new Error('Заполни все поля: name, slug, email')
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error('Slug может содержать только строчные латинские буквы, цифры и дефис')
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Некорректный email')
  }

  return { name, slug, email }
}
