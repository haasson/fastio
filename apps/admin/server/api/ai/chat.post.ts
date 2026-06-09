import { defineEventHandler, readBody, createError, setHeader } from 'h3'
import { useRuntimeConfig } from '#imports'
import { fetch as undiciFetch, ProxyAgent } from 'undici'
import { createOpenAI } from '@ai-sdk/openai'
import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from 'ai'
import { loadKnowledge } from '~/server/ai/loadKnowledge'
import { fetchTenantContext, formatContextForPrompt, type AiContext } from '~/server/ai/fetchContext'
import { createAiTools } from '~/server/ai/tools'
import { requireMemberOfTenant } from '~/server/utils/auth'
import { getServerSupabase } from '~/server/utils/supabase'
import { reportError } from '@fastio/shared/observability'

const STREAM_TIMEOUT_MS = 60_000

// VPS в РФ → api.openai.com заблочен. Если задан NUXT_OPENAI_PROXY_URL (или
// NUXT_TELEGRAM_PROXY_URL как фоллбэк) — все вызовы к OpenAI идут через прокси.
let _cachedDispatcher: { value: ProxyAgent | undefined } | null = null

function getOpenAiDispatcher(): ProxyAgent | undefined {
  if (_cachedDispatcher) return _cachedDispatcher.value

  const config = useRuntimeConfig()
  const proxyUrl = config.telegramProxyUrl?.trim()

  _cachedDispatcher = { value: proxyUrl ? new ProxyAgent(proxyUrl) : undefined }

  return _cachedDispatcher.value
}

const RL_USER_MAX = 30
const RL_USER_WINDOW_SECONDS = 60
const RL_TENANT_DAILY_MAX = 500
const RL_TENANT_DAILY_WINDOW_SECONDS = 86_400

export default defineEventHandler(async (event) => {
  const { messages, tenantId, currentRoute } = await readBody<{
    messages: UIMessage[]
    tenantId: string
    currentRoute?: string
  }>(event)

  const config = useRuntimeConfig(event)
  const apiKey = config.openaiApiKey

  if (!apiKey) {
    reportError(new Error('[ai-chat] OPENAI_API_KEY not configured'))
    throw createError({
      statusCode: 500,
      statusMessage: 'OPENAI_API_KEY is not configured',
    })
  }

  if (!tenantId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'tenantId is required',
    })
  }

  // userId берём из JWT, а не из body — иначе кто угодно мог дёргать AI с правами произвольного пользователя.
  const { userId } = await requireMemberOfTenant(event, tenantId)

  // Durable rate-limit: per-tenant 500/день (cost-cap на OpenAI: ~$1-3/день
  // на gpt-4.1-nano) + per-user 30/мин (горячий: отсекает спам/скрипт-атаку).
  // Tenant ПЕРВЫМ: consume_rate_limit инкрементит счётчик ДО проверки, и если
  // tenant исчерпан, user-счётчик не должен тоже жраться — иначе один спам-юзер
  // лочит legit-юзеров на минуту. consume_rate_limit (mig 264) — atomic upsert,
  // horizontally safe. Per-tariff квота — задача Stage 1.
  const sb = getServerSupabase()

  const { data: tenantOk, error: tenantRlError } = await sb.rpc('consume_rate_limit', {
    _key: `ai-chat:tenant:${tenantId}`,
    _max: RL_TENANT_DAILY_MAX,
    _window_seconds: RL_TENANT_DAILY_WINDOW_SECONDS,
  })

  if (tenantRlError) {
    reportError(tenantRlError, { context: 'ai-chat:rate-limit-tenant', userId, tenantId })
    throw createError({ statusCode: 500, statusMessage: 'Rate limit check failed' })
  }
  if (!tenantOk) {
    setHeader(event, 'retry-after', RL_TENANT_DAILY_WINDOW_SECONDS)
    throw createError({ statusCode: 429, statusMessage: 'Daily AI quota exhausted' })
  }

  const { data: userOk, error: userRlError } = await sb.rpc('consume_rate_limit', {
    _key: `ai-chat:user:${userId}`,
    _max: RL_USER_MAX,
    _window_seconds: RL_USER_WINDOW_SECONDS,
  })

  if (userRlError) {
    reportError(userRlError, { context: 'ai-chat:rate-limit-user', userId, tenantId })
    throw createError({ statusCode: 500, statusMessage: 'Rate limit check failed' })
  }
  if (!userOk) {
    setHeader(event, 'retry-after', RL_USER_WINDOW_SECONDS)
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  const dispatcher = getOpenAiDispatcher()
  const openai = createOpenAI({
    apiKey,
    ...(dispatcher
      ? { fetch: ((url: RequestInfo | URL, init?: RequestInit) => undiciFetch(url as string, { ...(init as object), dispatcher } as Parameters<typeof undiciFetch>[1])) as unknown as typeof globalThis.fetch }
      : {}),
  })

  const knowledge = await loadKnowledge(currentRoute)
  const tenantContext = await fetchTenantContext(tenantId, userId)
  const systemPrompt = buildSystemPrompt(knowledge, tenantContext, currentRoute)
  const tools = createAiTools(tenantId, userId)

  // 60s upper-bound на stream: gpt-4.1-nano обычно отвечает за <5s, 60s —
  // защита от зависшего upstream OpenAI. По истечении abortSignal прерывает
  // stream, юзер видит partial response (B1 в плане). cleanup идемпотентен:
  // вызывается в onFinish / onAbort / onError, повторный clearTimeout — no-op.
  //
  // Token-usage НЕ логируем здесь: handler возвращает Response сразу через
  // toUIMessageStreamResponse, request-scope в Sentry закрывается, и любой
  // breadcrumb из callback'ов летит в никуда (нет активного scope). Прод-
  // метрика token-usage — задача Stage 1 (audit_log / Grafana).
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS)
  const cleanup = (): void => clearTimeout(timeoutId)

  const result = streamText({
    model: openai('gpt-4.1-nano'),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(3),
    maxOutputTokens: 1024,
    abortSignal: controller.signal,
    onFinish: cleanup,
    onAbort: cleanup,
    onError: ({ error }) => {
      cleanup()
      reportError(error, { context: 'ai-chat:stream-error', tenantId, userId })
    },
  })

  return result.toUIMessageStreamResponse()
})

function buildSystemPrompt(
  knowledge: string,
  context: AiContext,
  currentRoute?: string,
): string {
  const contextText = formatContextForPrompt(context)

  const sections = [
    knowledge,
    '',
    '---',
    '',
    'Контекст текущего пользователя:',
    contextText,
  ]

  if (currentRoute) {
    sections.push(`Текущий раздел: ${currentRoute}`)
  }

  sections.push(
    '',
    '---',
    '',
    'ВАЖНО — «Столы» (модуль dineIn) включает и обслуживание в зале, и онлайн-брони. Это ОДИН модуль с вкладками:',
    '• «Заказ со стола» (/tables) = обслуживание гостей в зале ПРЯМО СЕЙЧАС: сессии, добавление блюд, расчёт, QR-коды, вызовы официанта.',
    '• «Бронирование» (вкладка /tables/reservations) = предварительная бронь на будущее: дата, время, гости.',
    '• Один тумблер «Столы» включает и зал, и брони. Приём онлайн-броней на витрине — отдельный свитч в «Столы → Настройки».',
    '• Когда спрашивают про обслуживание за столом — отвечай про раздел /tables (сессии, блюда, расчёт).',
    '• Когда спрашивают про брони — отвечай про вкладку «Бронирование» (/tables/reservations).',
    '',
    'Правила:',
    '- Ты — AI-ассистент платформы Fastio. Отвечай ТОЛЬКО на вопросы о Fastio, админ-панели и публичном сайте.',
    '- На любые вопросы, не связанные с Fastio (анекдоты, погода, программирование и т.д.) — вежливо откажи: "Я могу помочь только с вопросами по Fastio. Чем могу помочь в админке?"',
    '- Отвечай кратко, дружелюбно и по делу. Используй русский язык.',
    '- Давай ссылки ТОЛЬКО из раздела «Допустимые ссылки» базы знаний. НИКОГДА не придумывай URL-ы, которых нет в списке. Используй самый конкретный URL: для категорий — [Категории](/menu/categories), а НЕ [Меню](/menu). Для ссылок на публичный сайт используй URL из контекста пользователя (поле «Публичный сайт»). Если URL публичного сайта неизвестен — упоминай страницы текстом без ссылок.',
    '- Давай полный и исчерпывающий ответ сразу. НЕ предлагай "рассказать подробнее", "показать пошаговую инструкцию" и т.п. Если вопрос требует пошаговых действий — просто дай их. Не байти на продолжение разговора.',
    '',
    'Твои возможности и ограничения:',
    '- Ты УМЕЕШЬ: отвечать на вопросы текстом, давать пошаговые инструкции текстом, давать ссылки на разделы админки, создавать обращения в поддержку (инструмент createSupportTicket).',
    '- Ты НЕ УМЕЕШЬ: показывать скриншоты, запускать туры, вносить изменения в настройки, создавать/редактировать данные (блюда, заказы, категории и т.д.), отправлять email или сообщения.',
    '- НИКОГДА не предлагай то, чего не умеешь. Не говори "могу показать скриншот", "давай запущу тур", "могу настроить за тебя". Если пользователь просит что-то сделать — объясни текстом как это сделать самому.',
    '- В платформе есть интерактивные туры (пошаговые обучающие гиды прямо в интерфейсе). Ты не можешь их запускать, но можешь предложить пройти тур: дай ссылку [Виртуальные туры](/help/tours). Если вопрос касается создания категории/блюда/модификаторов/добавок — упомяни что есть тур на эту тему.',
    '- Учитывай состояние модулей из контекста:',
    '  • ВКЛЮЧЁН — просто отвечай на вопрос. НЕ упоминай что модуль включён.',
    '  • ВЫКЛЮЧЕН — объясни что он выключен и предложи включить: [Настройки → Модули](/settings/modules).',
    '  • ЗАБЛОКИРОВАН ТАРИФОМ — объясни какой тариф нужен и предложи апгрейд: [Биллинг](/account/billing).',
    '  • НЕДОСТУПЕН для типа бизнеса — НИКОГДА не упоминай этот модуль, не рассказывай о нём, не предлагай его включить. Веди себя как будто его не существует для этого пользователя.',
    '- Учитывай роль и пермишены. Если у пользователя нет доступа к разделу — объясни что нужно обратиться к владельцу/администратору.',
    '- Не придумывай функции, которых нет в платформе. Отвечай только на основе базы знаний.',
    '- Если не можешь помочь — предложи создать обращение в поддержку. Опиши что напишешь и дождись подтверждения пользователя перед вызовом инструмента createSupportTicket.',
    '- НИКОГДА не вызывай createSupportTicket без явного согласия пользователя.',
    '- При описании действий используй точные названия кнопок и элементов интерфейса из базы знаний. Например: «нажмите кнопку «Добавить категорию»», а не «создайте категорию». Названия кнопок оборачивай в «кавычки-ёлочки».',
    '- Форматируй ответы в markdown: жирный текст, списки, ссылки.',
  )

  return sections.join('\n')
}
