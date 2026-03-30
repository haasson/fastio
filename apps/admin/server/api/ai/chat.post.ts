import { defineEventHandler, readBody, createError } from 'h3'
import { useRuntimeConfig } from '#imports'
import { createAnthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'

export default defineEventHandler(async (event) => {
  const { messages, context } = await readBody(event)

  const config = useRuntimeConfig(event)
  const apiKey = config.anthropicApiKey

  if (!apiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'ANTHROPIC_API_KEY is not configured',
    })
  }

  const anthropic = createAnthropic({ apiKey })

  const systemPrompt = buildSystemPrompt(context)

  const result = streamText({
    model: anthropic('claude-haiku-4-5-20251001'),
    system: systemPrompt,
    messages,
    maxOutputTokens: 1024,
  })

  return result.toTextStreamResponse()
})

function buildSystemPrompt(context?: { tenantName?: string; businessType?: string; currentRoute?: string }) {
  const sections = [
    `Ты — ИИ-ассистент в админ-панели Fastio, SaaS-платформы для ресторанов, кафе, магазинов и сервисных компаний.`,
    `Твоя задача — помогать пользователям работать с админкой: объяснять функции, помогать настраивать меню, заказы и другие разделы.`,
    '',
    `Возможности платформы Fastio:`,
    `- Управление меню (блюда, категории, модификаторы, добавки)`,
    `- Приём и управление заказами (доставка, самовывоз)`,
    `- Кухонный модуль (отслеживание готовности блюд)`,
    `- Столы и бронирования`,
    `- Акции и промокоды`,
    `- Управление контентом сайта (баннеры, галереи, страницы)`,
    `- Настройка оформления и темы сайта`,
    `- Управление командой и филиалами`,
    `- Настройки уведомлений (email, Telegram)`,
    '',
    `Разделы админки:`,
    `- / — Дашборд (обзор статистики)`,
    `- /menu — Управление меню (категории, блюда, модификаторы, добавки)`,
    `- /orders — Заказы`,
    `- /kitchen — Кухня`,
    `- /tables — Столы`,
    `- /reservations — Бронирования`,
    `- /promotions — Акции`,
    `- /team/members — Команда`,
    `- /team/branches — Филиалы`,
    `- /content — Контент сайта`,
    `- /appearance — Оформление`,
    `- /settings — Настройки`,
  ]

  if (context?.tenantName) {
    sections.push('', `Текущий тенант: ${context.tenantName}`)
  }

  if (context?.businessType) {
    const labels: Record<string, string> = {
      food: 'Общепит (ресторан/кафе)',
      retail: 'Розничная торговля',
      services: 'Услуги',
    }

    sections.push(`Тип бизнеса: ${labels[context.businessType] || context.businessType}`)
  }

  if (context?.currentRoute) {
    sections.push(`Пользователь сейчас находится в разделе: ${context.currentRoute}`)
  }

  sections.push(
    '',
    `Правила:`,
    `- Отвечай кратко, дружелюбно и по делу`,
    `- Используй русский язык`,
    `- Если не знаешь ответа — честно скажи об этом`,
    `- Давай практические советы, привязанные к конкретным разделам админки`,
    `- Не придумывай функции, которых нет в платформе`,
  )

  return sections.join('\n')
}
