import { createClient } from 'npm:@supabase/supabase-js@2'
import { withSentry } from '../_shared/sentry.ts'

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), { ...init, headers: { 'Content-Type': 'application/json' } })

// Hostname: label = LDH (letter/digit/hyphen, не в начале/конце), 1-63 символа;
// общее имя 1-253 символа; минимум 2 label'а. TLD разрешает digits, чтобы пройти
// punycode-IDN типа `.xn--p1ai` (.рф). Юзер сам конвертит IDN в punycode перед отправкой.
const DOMAIN_REGEX = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

type NormalizeResult =
  | { ok: true; domain: string }
  | { ok: false; error: string }

function normalizeDomain(raw: unknown): NormalizeResult {
  if (!raw || typeof raw !== 'string') return { ok: false, error: 'Некорректный домен' }
  // Срезаем протокол / путь / query — юзер часто вставляет полный URL.
  // `www.` НЕ режем: apex и www — разные записи в DNS, silent rewrite сюрпризит.
  const stripped = raw.trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split('?')[0]
    .split('#')[0]
  if (!stripped) return { ok: false, error: 'Некорректный домен' }
  if (stripped.startsWith('www.')) {
    return { ok: false, error: 'Введите apex-домен без префикса www (например, example.com)' }
  }
  // localhost/IP/internal hostnames отсекаем явно.
  if (stripped === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(stripped) || stripped.endsWith('.localhost')) {
    return { ok: false, error: 'Некорректный домен' }
  }
  if (!DOMAIN_REGEX.test(stripped)) return { ok: false, error: 'Некорректный домен' }
  return { ok: true, domain: stripped }
}

type DnsResult =
  | { ok: true }
  | { ok: false; reason: 'no_record' | 'mismatch' | 'lookup_failed' }

// Резолвим TXT _fastio-verify.<domain> и ждём значение === tenant.id.
// Без публичного DNS-владения добавить произвольный домен (например, google.com)
// в наш Vercel-проект нельзя — это закрывает DOS-вектор «зарезервируй чужой домен».
async function verifyDnsOwnership(domain: string, tenantId: string): Promise<DnsResult> {
  let records: string[][]
  try {
    records = await Deno.resolveDns(`_fastio-verify.${domain}`, 'TXT')
  } catch (err) {
    // NotFound → DNS просто нет (юзер ещё не настроил). Остальное — permission/network/
    // misconfigured resolver. Логируем чтобы понять, почему легитимный setup не проходит.
    if (err instanceof Deno.errors.NotFound) {
      return { ok: false, reason: 'no_record' }
    }
    console.error('DNS lookup failed for', domain, err)
    return { ok: false, reason: 'lookup_failed' }
  }
  if (records.some((parts) => parts.join('').trim() === tenantId)) return { ok: true }
  return { ok: false, reason: 'mismatch' }
}

Deno.serve(withSentry('add-custom-domain', async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401 })
  }

  const userSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data: { user }, error: authError } = await userSupabase.auth.getUser()
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body: { domain?: string; tenantId?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const normalizeRes = normalizeDomain(body.domain)
  if (!normalizeRes.ok) {
    return json({ error: normalizeRes.error }, { status: 400 })
  }
  const normalizedDomain = normalizeRes.domain

  const tenantIdInput = body.tenantId
  if (!tenantIdInput || typeof tenantIdInput !== 'string') {
    return json({ error: 'tenantId is required' }, { status: 400 })
  }

  const adminSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Проверяем, что вызывающий — owner именно ЭТОГО тенанта (а не любого «своего»).
  const { data: tenant } = await adminSupabase
    .from('tenants')
    .select('id, custom_domain')
    .eq('id', tenantIdInput)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!tenant) {
    return json({ error: 'Tenant not found' }, { status: 404 })
  }

  // Uniqueness: домен не должен висеть на другом тенанте.
  const { data: existing } = await adminSupabase
    .from('tenants')
    .select('id')
    .eq('custom_domain', normalizedDomain)
    .neq('id', tenant.id)
    .maybeSingle()

  if (existing) {
    return json({ error: 'Этот домен уже используется другим тенантом' }, { status: 409 })
  }

  // DNS TXT verification — без TXT не пропускаем к Coolify API.
  const dns = await verifyDnsOwnership(normalizedDomain, tenant.id as string)
  if (!dns.ok) {
    // reason: no_record / mismatch / lookup_failed — нужно для дебага юзеру,
    // чтобы он понимал «не нашли TXT вообще» vs «TXT есть, но значение не то».
    return json({
      error: 'dns_verification_required',
      message: 'Добавьте TXT-запись для подтверждения владения доменом',
      reason: dns.reason,
      instruction: {
        host: `_fastio-verify.${normalizedDomain}`,
        type: 'TXT',
        value: tenant.id,
      },
    }, { status: 412 })
  }

  const coolifyApiUrl = Deno.env.get('COOLIFY_API_URL')
  const coolifyToken = Deno.env.get('COOLIFY_TOKEN')
  const coolifyStorefrontUuid = Deno.env.get('COOLIFY_STOREFRONT_UUID')
  if (!coolifyApiUrl || !coolifyToken || !coolifyStorefrontUuid) {
    console.error('Coolify env missing:', { coolifyApiUrl: !!coolifyApiUrl, coolifyToken: !!coolifyToken, coolifyStorefrontUuid: !!coolifyStorefrontUuid })
    return json({ error: 'Domain registration misconfigured' }, { status: 500 })
  }

  const coolifyHeaders = {
    Authorization: `Bearer ${coolifyToken}`,
    'Content-Type': 'application/json',
  }
  const appUrl = `${coolifyApiUrl}/api/v1/applications/${coolifyStorefrontUuid}`

  // Coolify v4 не имеет POST /domains — нужно PATCH /applications/{uuid} с полным CSV fqdn.
  // Поэтому: GET текущий fqdn → выкинуть старый custom_domain тенанта (если был) и сам
  // новый домен (idempotent) → PATCH весь список + instant_deploy для пересборки Traefik labels.

  const withTimeout = async (url: string, init: RequestInit, ms = 10_000) => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), ms)
    try {
      return await fetch(url, { ...init, signal: controller.signal })
    } finally {
      clearTimeout(timeoutId)
    }
  }

  let getResp: Response
  try {
    getResp = await withTimeout(appUrl, { method: 'GET', headers: coolifyHeaders })
  } catch (err) {
    console.error('Coolify GET app failed:', err)
    return json({ error: 'Domain registration failed' }, { status: 502 })
  }
  if (!getResp.ok) {
    const text = await getResp.text().catch(() => '')
    console.error('Coolify GET app error:', getResp.status, text)
    return json({ error: 'Domain registration failed' }, { status: 502 })
  }
  const app = await getResp.json().catch(() => null) as { fqdn?: string | null } | null
  const currentFqdn = (app?.fqdn ?? '').split(',').map((s) => s.trim()).filter(Boolean)

  const previousDomain = (tenant as { custom_domain: string | null }).custom_domain
  const newDomainUrl = `https://${normalizedDomain}`
  const nextFqdn = [
    ...currentFqdn.filter((entry) => {
      const host = entry.replace(/^https?:\/\//, '').split('/')[0]
      if (host === normalizedDomain) return false
      if (previousDomain && host === previousDomain) return false
      return true
    }),
    newDomainUrl,
  ]

  let patchResp: Response
  try {
    patchResp = await withTimeout(appUrl, {
      method: 'PATCH',
      headers: coolifyHeaders,
      body: JSON.stringify({ domains: nextFqdn.join(','), instant_deploy: true }),
    })
  } catch (err) {
    console.error('Coolify PATCH app failed:', err)
    return json({ error: 'Domain registration failed' }, { status: 502 })
  }
  if (!patchResp.ok) {
    const text = await patchResp.text().catch(() => '')
    console.error('Coolify PATCH app error:', patchResp.status, text)
    return json({ error: 'Domain registration failed' }, { status: 502 })
  }

  await adminSupabase
    .from('tenants')
    .update({ custom_domain: normalizedDomain })
    .eq('id', tenant.id)

  return json({ success: true, domain: normalizedDomain }, { status: 200 })
}))
