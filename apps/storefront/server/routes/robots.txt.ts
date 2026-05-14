import { getRequestHost, getRequestProtocol } from 'h3'

export default defineEventHandler((event) => {
  const host = getRequestHost(event, { xForwardedHost: true })
  const proto = getRequestProtocol(event, { xForwardedProto: true })
  const sitemapUrl = host ? `${proto}://${host}/sitemap.xml` : '/sitemap.xml'

  setResponseHeader(event, 'content-type', 'text/plain; charset=utf-8')
  setResponseHeader(event, 'cache-control', 'public, max-age=3600')

  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /account/',
    'Disallow: /checkout',
    'Disallow: /order/',
    'Disallow: /api/',
    'Disallow: /table/',
    '',
    `Sitemap: ${sitemapUrl}`,
    '',
  ].join('\n')
})
