// buildHead — pure helper for constructing useHead MetaObject from Tenant data.
// PERF-01: Fixes missing og:url, relative og:image, missing twitter card + canonical link.
//
// This is the authoritative implementation of the null-safe ogUrl derivation (PERF-01).
// The canonical null-safe form is defined here — supersedes the early sketch in PATTERNS.md line 59.
//
// Security (T-4-01): rawOgImage guard rejects javascript:, data: and relative URLs.
// Security (T-4-02): og:url derived from tenant.customDomain ?? slug.fastio.ru — never from
//   request URL to prevent leaking internal Coolify hostnames (Pitfall 2, RESEARCH.md).
//   Null-safe ternary prevents https://undefined.fastio.ru when tenant is null (locked by Test 7).

import type { Tenant } from '@fastio/shared'

// Minimal types matching unhead MetaObject shape used by useHead in Nuxt 3.
// LinkEntry uses string | undefined to support optional attributes (type, key on favicon links).
// Not importing from unhead directly to keep this helper framework-agnostic and pure.
type MetaEntry = Record<string, string>
type LinkEntry = Record<string, string | undefined>

export type MetaObject = {
  titleTemplate?: (pageTitle?: string) => string
  meta?: MetaEntry[]
  link?: LinkEntry[]
}

export const buildHead = (
  tenant: Tenant | null,
  googleFontLink: LinkEntry[] = [],
  faviconLink: LinkEntry[] = [],
): MetaObject => {
  const seo = tenant?.seo
  const title = seo?.metaTitle || tenant?.name || ''
  const description = seo?.metaDescription || ''

  // og:image: guard rejects relative paths and non-http schemes (T-4-01)
  const rawOgImage = tenant?.seo?.ogImage || tenant?.siteContent?.logo || ''
  const ogImage = rawOgImage.startsWith('http') ? rawOgImage : ''

  // og:url: null-safe derivation — never emits https://undefined.fastio.ru (T-4-02)
  // Using ternary instead of ?. + template string to prevent undefined expansion.
  const host = tenant?.customDomain
    ?? (tenant?.slug ? `${tenant.slug}.fastio.ru` : '')
  const ogUrl = host ? `https://${host}` : ''

  return {
    titleTemplate: (pageTitle) => pageTitle ? `${pageTitle} — ${title}` : title,
    meta: [
      { name: 'description', content: description },
      { name: 'robots', content: seo?.robots === 'noindex' ? 'noindex,nofollow' : 'index,follow' },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: 'website' },
      ...(ogUrl ? [{ property: 'og:url', content: ogUrl }] : []),
      ...(ogImage ? [{ property: 'og:image', content: ogImage }] : []),
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      ...(ogImage ? [{ name: 'twitter:image', content: ogImage }] : []),
    ],
    link: [
      ...(ogUrl ? [{ rel: 'canonical', href: ogUrl }] : []),
      ...googleFontLink,
      ...faviconLink,
    ],
  }
}
