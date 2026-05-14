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

  // Coolify API с timeout — без него висящий запрос блокирует функцию.
  // Coolify API внутри VPS, но всё равно ставим timeout на случай зависания контейнера.
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10_000)
  let coolifyResponse: Response
  try {
    coolifyResponse = await fetch(
      `${coolifyApiUrl}/api/v1/applications/${coolifyStorefrontUuid}/domains`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${coolifyToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domain: `https://${normalizedDomain}` }),
        signal: controller.signal,
      },
    )
  } catch (err) {
    clearTimeout(timeoutId)
    console.error('Coolify API request failed:', err)
    return json({ error: 'Domain registration failed' }, { status: 502 })
  }
  clearTimeout(timeoutId)

  if (!coolifyResponse.ok) {
    // Не прокидываем Coolify error в клиента — он может содержать internal context.
    const text = await coolifyResponse.text().catch(() => '')
    console.error('Coolify error:', coolifyResponse.status, text)
    return json({ error: 'Domain registration failed' }, { status: 502 })
  }

  await adminSupabase
    .from('tenants')
    .update({ custom_domain: normalizedDomain })
    .eq('id', tenant.id)

  return json({ success: true, domain: normalizedDomain }, { status: 200 })
}))
