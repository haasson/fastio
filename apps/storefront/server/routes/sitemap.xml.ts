import { getRequestHost, getRequestProtocol } from 'h3'
import { getTenantDb } from '../utils/tenantDb'
import type { Tenant } from '@fastio/shared'

type SitemapEntry = { loc: string; changefreq?: string; priority?: number }

function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function renderXml(entries: SitemapEntry[]): string {
  const urls = entries.map((e) => {
    const parts: string[] = [`<loc>${escape(e.loc)}</loc>`]
    if (e.changefreq) parts.push(`<changefreq>${e.changefreq}</changefreq>`)
    if (e.priority !== undefined) parts.push(`<priority>${e.priority.toFixed(1)}</priority>`)
    return `<url>${parts.join('')}</url>`
  }).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`
}

export default defineEventHandler(async (event) => {
  const tenant = event.context.tenant as Tenant | undefined
  if (!tenant) {
    setResponseStatus(event, 404)
    return ''
  }

  if (tenant.seo?.robots === 'noindex') {
    setResponseHeader(event, 'content-type', 'application/xml; charset=utf-8')
    return renderXml([])
  }

  const isServices = tenant.businessType === 'services'
  const db = getTenantDb(event)
  const host = getRequestHost(event, { xForwardedHost: true })
  const proto = getRequestProtocol(event, { xForwardedProto: true })
  const baseUrl = host ? `${proto}://${host}` : ''

  const url = (path: string): string => `${baseUrl}${path}`

  const entries: SitemapEntry[] = [
    { loc: url('/'), changefreq: 'daily', priority: 1.0 },
    { loc: url(isServices ? '/services' : '/menu'), changefreq: 'daily', priority: 0.9 },
  ]

  if (isServices) {
    entries.push({ loc: url('/appointments'), changefreq: 'weekly', priority: 0.7 })

    const { data: categories } = await db
      .from('categories')
      .select('slug')
      .eq('kind', 'service')
      .eq('active', true)
      .is('deleted_at', null)

    for (const row of (categories ?? [])) {
      const slug = (row as { slug: string | null }).slug
      if (slug) entries.push({ loc: url(`/category/${slug}`), changefreq: 'weekly', priority: 0.6 })
    }
  } else {
    const { data: categories } = await db
      .from('categories')
      .select('slug')
      .eq('kind', 'food')
      .eq('active', true)
      .is('deleted_at', null)

    for (const row of (categories ?? [])) {
      const slug = (row as { slug: string | null }).slug
      if (slug) entries.push({ loc: url(`/category/${slug}`), changefreq: 'weekly', priority: 0.6 })
    }
  }

  setResponseHeader(event, 'content-type', 'application/xml; charset=utf-8')
  setResponseHeader(event, 'cache-control', 'public, max-age=3600')
  return renderXml(entries)
})
