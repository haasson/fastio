// PERF-01: Unit tests for buildHead helper
// Verifies OG meta, Twitter card, canonical link, and null-safety invariants.
// Import uses RELATIVE path (not ~/...) because root vitest.config.ts line 14
// binds the '~' alias to apps/admin, not apps/storefront.
import { describe, it, expect } from 'vitest'
import { buildHead } from './shared/composables/buildHead'
import type { Tenant } from '@fastio/shared'

// Minimal fake tenant factory — only fields used by buildHead
function makeTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: 'test-id',
    name: 'Test Venue',
    slug: 'test',
    customDomain: null,
    ownerId: 'owner-1',
    businessType: 'retail',
    menuStyle: 'food',
    theme: {
      primaryColor: '#000',
      fontFamily: '',
      headingFontFamily: '',
      preset: 'fresh',
      palette: null,
      buttonRadius: 'rounded',
      cardRadius: 14,
      cardShadow: 'subtle',
      customThemes: [],
      activeCustomId: null,
    },
    siteLayout: {} as Tenant['siteLayout'],
    siteContent: {
      logo: null,
      hero: { bgUrl: null, text: null },
      about: { coverUrl: null, text: '' },
      delivery: { manualText: '' },
    },
    contacts: {
      phone: '',
      email: '',
      address: '',
      instagram: null,
      vk: null,
      telegram: null,
      whatsapp: null,
      max: null,
      offerUrl: null,
    },
    workingHoursSchedule: null,
    notifications: { email: null },
    balance: 0,
    subscription: {
      status: 'active',
      plan: 'start',
      trialEndsAt: null,
      renewsAt: null,
      pastDueAt: null,
      priceOverride: null,
      gracePeriodDays: null,
    },
    modules: {
      delivery: true,
      pickup: true,
      modifiers: false,
      addons: false,
      promotions: false,
      combos: false,
      customRoles: false,
      dineIn: false,
      kitchen: false,
      reservations: false,
      customers: false,
      services: false,
      branches: false,
    },
    deliveryMinOrder: 0,
    deliveryFee: 0,
    freeDeliveryFrom: 0,
    deliveryDescription: '',
    deliveryMode: 'fixed',
    deliveryAvailable: false,
    orderingEnabled: true,
    currency: 'RUB',
    timezone: 'Europe/Moscow',
    seo: {
      metaTitle: null,
      metaDescription: null,
      ogImage: null,
      favicon: null,
      robots: 'index',
      googleAnalyticsId: null,
      yandexMetrikaId: null,
    },
    kitchenUrgencyMinutes: 15,
    kitchenConfig: {} as Tenant['kitchenConfig'],
    orderNumberConfig: null,
    maxAddonsDefault: null,
    onboardingCompleted: true,
    onboardingState: { currentStepId: null, completedAt: null, dismissedAt: null },
    orderSchedulingConfig: {
      enabled: false,
      slotStep: 30,
      daysAhead: 3,
      deliveryLeadMinutes: 60,
      pickupLeadMinutes: 30,
      closeBufferMinutes: 30,
      holdingStatusId: null,
      nextStatusId: null,
    },
    legalInfo: null,
    paymentMethods: [],
    branchSelectionMode: 'unified',
    colorPalettes: { delivery_zones: [], branches: [], service_categories: [] },
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  } as Tenant
}

describe('buildHead', () => {
  it('returns og:image only when rawOgImage starts with https://', () => {
    const tenant = makeTenant({ seo: { metaTitle: null, metaDescription: null, ogImage: '/relative/path.png', favicon: null, robots: 'index', googleAnalyticsId: null, yandexMetrikaId: null } })
    const result = buildHead(tenant)
    const ogImage = result.meta?.find((m) => 'property' in m && m.property === 'og:image')
    expect(ogImage).toBeUndefined()
  })

  it('emits og:image absolute URL when tenant.seo.ogImage starts with https://', () => {
    const absoluteUrl = 'https://x.supabase.co/storage/v1/object/public/logo.png'
    const tenant = makeTenant({ seo: { metaTitle: null, metaDescription: null, ogImage: absoluteUrl, favicon: null, robots: 'index', googleAnalyticsId: null, yandexMetrikaId: null } })
    const result = buildHead(tenant)
    const ogImage = result.meta?.find((m) => 'property' in m && m.property === 'og:image')
    expect(ogImage).toBeDefined()
    expect(ogImage?.content).toBe(absoluteUrl)
  })

  it('emits og:url from customDomain when present', () => {
    const tenant = makeTenant({ customDomain: 'example.com', slug: 'demo' })
    const result = buildHead(tenant)
    const ogUrl = result.meta?.find((m) => 'property' in m && m.property === 'og:url')
    const canonical = result.link?.find((l) => l.rel === 'canonical')
    expect(ogUrl?.content).toBe('https://example.com')
    expect(canonical?.href).toBe('https://example.com')
  })

  it('emits og:url from slug.fastio.ru when customDomain is null', () => {
    const tenant = makeTenant({ customDomain: null, slug: 'demo' })
    const result = buildHead(tenant)
    const ogUrl = result.meta?.find((m) => 'property' in m && m.property === 'og:url')
    expect(ogUrl?.content).toBe('https://demo.fastio.ru')
  })

  it('emits twitter card meta', () => {
    const absoluteUrl = 'https://x.supabase.co/storage/v1/object/public/logo.png'
    const tenant = makeTenant({
      name: 'My Cafe',
      seo: {
        metaTitle: 'My Cafe',
        metaDescription: 'Best cafe in town',
        ogImage: absoluteUrl,
        favicon: null,
        robots: 'index',
        googleAnalyticsId: null,
        yandexMetrikaId: null,
      },
    })
    const result = buildHead(tenant)
    const twitterCard = result.meta?.find((m) => 'name' in m && m.name === 'twitter:card')
    const twitterTitle = result.meta?.find((m) => 'name' in m && m.name === 'twitter:title')
    const twitterDesc = result.meta?.find((m) => 'name' in m && m.name === 'twitter:description')
    const twitterImage = result.meta?.find((m) => 'name' in m && m.name === 'twitter:image')
    expect(twitterCard?.content).toBe('summary_large_image')
    expect(twitterTitle).toBeDefined()
    expect(twitterDesc).toBeDefined()
    expect(twitterImage?.content).toBe(absoluteUrl)
  })

  it('falls back to siteContent.logo when seo.ogImage missing', () => {
    const logoUrl = 'https://x.supabase.co/logo.png'
    const tenant = makeTenant({
      seo: { metaTitle: null, metaDescription: null, ogImage: null, favicon: null, robots: 'index', googleAnalyticsId: null, yandexMetrikaId: null },
      siteContent: {
        logo: logoUrl,
        hero: { bgUrl: null, text: null },
        about: { coverUrl: null, text: '' },
        delivery: { manualText: '' },
      },
    })
    const result = buildHead(tenant)
    const ogImage = result.meta?.find((m) => 'property' in m && m.property === 'og:image')
    expect(ogImage?.content).toBe(logoUrl)
  })

  it('null tenant is safe — never emits og:url containing undefined', () => {
    const result = buildHead(null)
    const ogUrl = result.meta?.find((m) => 'property' in m && m.property === 'og:url')
    const canonical = result.link?.find((l) => l.rel === 'canonical')
    expect(ogUrl).toBeUndefined()
    expect(canonical).toBeUndefined()
    const serialized = JSON.stringify(result)
    expect(serialized.includes('undefined')).toBe(false)
    expect(serialized.includes('https://undefined')).toBe(false)
  })
})
