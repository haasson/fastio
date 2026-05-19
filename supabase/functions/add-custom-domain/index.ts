import { createClient } from '@supabase/supabase-js'
import { captureException, flushSentry, withSentry } from '../_shared/sentry.ts'

// FNV-1a 64-bit hash → bigint-safe для pg_try_advisory_xact_lock(bigint).
// Postgres bigint = signed 64-bit. JS number теряет точность после 2^53, поэтому
// собираем хеш в BigInt и приводим к подписанному диапазону через wrap-around,
// потом отдаём как Number (advisory lock принимает int8 — supabase-js сериализует
// BigInt не везде корректно, а число до Number.MAX_SAFE_INTEGER через biased mod —
// уже достаточно для распределения по ключам).
//
// Берём mod 2^53-1 чтобы получить безопасное JS-число; коллизии теоретически
// возможны, но для дробящего barrier'а на FQDN их вероятность пренебрежима.
function hashStringToInt(input: string): number {
  const FNV_OFFSET = 0xcbf29ce484222325n
  const FNV_PRIME = 0x100000001b3n
  const MASK_64 = (1n << 64n) - 1n
  let hash = FNV_OFFSET
  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i))
    hash = (hash * FNV_PRIME) & MASK_64
  }
  // Сжимаем в Number.MAX_SAFE_INTEGER, чтобы supabase-js точно сериализовал в JSON.
  const safe = hash % BigInt(Number.MAX_SAFE_INTEGER)
  return Number(safe)
}

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

  // Advisory lock против concurrent попыток зарегать один и тот же FQDN.
  // pg_try_advisory_xact_lock держит лок до конца транзакции — а здесь транзакция
  // implicit вокруг одного RPC-вызова (см. комментарий в миграции 297). Лок работает
  // как «дробящий barrier»: если две edge-функции одновременно дёрнули RPC,
  // одна получит true, другая — false → 409. Окно гонки между RPC-вызовом и
  // Coolify GET/PATCH остаётся ненулевым, но это лучшее что можно сделать без
  // dedicated pending_domains таблицы с UNIQUE constraint.
  const lockKey = hashStringToInt(`custom-domain:${normalizedDomain}`)
  const { data: locked, error: lockError } = await adminSupabase.rpc('try_advisory_xact_lock', { p_key: lockKey })
  if (lockError) {
    console.error('try_advisory_xact_lock failed:', lockError)
    captureException(lockError, { fn: 'add-custom-domain', stage: 'advisory-lock', fqdn: normalizedDomain })
    await flushSentry()
    return json({ error: 'Domain registration failed' }, { status: 500 })
  }
  if (locked !== true) {
    return json({ error: 'Параллельная регистрация этого домена уже выполняется, повторите запрос через несколько секунд' }, { status: 409 })
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
  // Сохраняем исходный CSV в первоначальном виде — для compensation rollback,
  // чтобы вернуть Coolify в state до нашего PATCH (а не «реконструированный» список).
  const previousFqdnCsv = app?.fqdn ?? ''
  const currentFqdn = previousFqdnCsv.split(',').map((s) => s.trim()).filter(Boolean)

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

  // Coolify уже зарегил домен. Если DB UPDATE упадёт — у нас будет orphan-домен
  // в Coolify (Traefik роутит трафик в наше приложение, но БД не знает про этот
  // tenant↔domain маппинг → витрина не определит тенанта по hostname).
  // Поэтому: попытка UPDATE → если ошибка → compensation PATCH откатить Coolify
  // обратно к previousFqdnCsv.
  const { error: updateError } = await adminSupabase
    .from('tenants')
    .update({ custom_domain: normalizedDomain })
    .eq('id', tenant.id)

  if (updateError) {
    // 23505 = unique_violation на tenants_custom_domain_key. Возникает когда параллельный
    // запрос успел вставить тот же домен между нашими preflight-check и UPDATE
    // (advisory lock сужает окно, но не закрывает полностью). Это ожидаемая
    // race-ситуация, а не баг — НЕ шлём в Sentry, чтобы не засрать дашборд.
    const isUniqueViolation = (updateError as { code?: string })?.code === '23505'
    console.error('DB UPDATE custom_domain failed, attempting Coolify rollback:', updateError)
    if (!isUniqueViolation) {
      captureException(updateError, {
        fn: 'add-custom-domain',
        stage: 'db-update',
        fqdn: normalizedDomain,
        tenantId: tenant.id,
      })
    }

    // Compensation: возвращаем Coolify к исходному CSV. instant_deploy:true чтобы
    // Traefik сразу убрал labels — иначе домен останется висеть в роутере.
    let rollbackResp: Response | null = null
    let rollbackErr: unknown = null
    try {
      rollbackResp = await withTimeout(appUrl, {
        method: 'PATCH',
        headers: coolifyHeaders,
        body: JSON.stringify({ domains: previousFqdnCsv, instant_deploy: true }),
      })
    } catch (err) {
      rollbackErr = err
    }

    if (rollbackErr || !rollbackResp || !rollbackResp.ok) {
      // Двойной фейл: Coolify добавил домен, БД не записала, rollback тоже упал.
      // Это требует ручного фикса: либо вручную убрать домен из Coolify UI,
      // либо вручную проставить custom_domain в tenants. Поднимаем alert-уровень.
      const rollbackStatus = rollbackResp?.status
      const rollbackText = rollbackResp ? await rollbackResp.text().catch(() => '') : ''
      captureException(
        rollbackErr ?? new Error(`Coolify rollback failed: status=${rollbackStatus} body=${rollbackText}`),
        {
          fn: 'add-custom-domain',
          stage: 'compensation-failed',
          fqdn: normalizedDomain,
          tenantId: tenant.id,
          originalError: String(updateError?.message ?? updateError),
          rollbackStatus,
          rollbackBody: rollbackText.slice(0, 500),
          manualFix: `1) Coolify: убрать ${newDomainUrl} из app ${coolifyStorefrontUuid} domains; 2) Проверить tenants.custom_domain для tenant ${tenant.id}`,
        },
        { compensation: true, severity: 'critical', alert: true },
      )
      await flushSentry()
      return json({
        error: 'Domain registration partially failed — администратор уведомлён, домен будет настроен вручную',
      }, { status: 503 })
    }

    // Rollback успешен — состояние консистентно (Coolify откатился, БД и так не обновилась).
    if (!isUniqueViolation) {
      captureException(updateError, {
        fn: 'add-custom-domain',
        stage: 'db-update-rolled-back',
        fqdn: normalizedDomain,
        tenantId: tenant.id,
      }, { compensation: true })
      await flushSentry()
      return json({ error: 'Не удалось сохранить домен, попробуйте ещё раз' }, { status: 503 })
    }
    // unique_violation после rollback: домен забрал другой тенант между нашими проверкой и UPDATE.
    await flushSentry()
    return json({ error: 'Этот домен уже используется другим тенантом' }, { status: 409 })
  }

  return json({ success: true, domain: normalizedDomain }, { status: 200 })
}))
