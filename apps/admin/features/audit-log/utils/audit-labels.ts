// Русскоязычный слой для журнала аудита.
// В БД хранятся латинские коды (entity_type, action, ключи полей), здесь — их русские
// названия для UI. Так фильтры стабильны, а интерфейс на русском.

import type { AuditLog, AuditLogFieldDiff } from '@fastio/shared'

export type ActionTone = 'default' | 'success' | 'primary' | 'warning' | 'error'

// ─── Типы сущностей ───────────────────────────────────────────────
export const ENTITY_TYPE_LABELS: Record<string, string> = {
  dish: 'Блюдо',
  category: 'Категория',
  modifier_group: 'Группа модификаторов',
  modifier_option: 'Опция модификатора',
  addon: 'Добавка',
  addon_preset: 'Пресет добавок',
  combo: 'Комбо',
  combo_item: 'Позиция комбо',
  dish_tag: 'Тег',
  branch: 'Филиал',
  role: 'Роль',
  member: 'Сотрудник',
  invitation: 'Приглашение',
  table: 'Стол',
  reservation: 'Бронь',
  service: 'Услуга',
  promo_code: 'Промокод',
  promotion: 'Акция',
  settings: 'Настройки заведения',
}

// ─── Действия ─────────────────────────────────────────────────────
const ACTION_LABELS: Record<string, { label: string; tone: ActionTone }> = {
  created: { label: 'Создано', tone: 'success' },
  updated: { label: 'Изменено', tone: 'primary' },
  deleted: { label: 'Удалено', tone: 'error' },
  restored: { label: 'Восстановлено', tone: 'warning' },
}

// ─── Поля (общие + специфичные) ───────────────────────────────────
const FIELD_LABELS: Record<string, string> = {
  name: 'Название',
  code: 'Код',
  title: 'Заголовок',
  price: 'Цена',
  description: 'Описание',
  long_description: 'Подробное описание',
  active: 'Активность',
  is_active: 'Активность',
  is_open: 'Открыт',
  photo: 'Фото',
  photos: 'Фото',
  photo_url: 'Фото',
  weight: 'Вес',
  weight_unit: 'Ед. веса',
  duration: 'Длительность',
  max_duration: 'Макс. длительность',
  capacity: 'Вместимость',
  color: 'Цвет',
  icon: 'Иконка',
  address: 'Адрес',
  phone: 'Телефон',
  delivery_fee: 'Стоимость доставки',
  delivery_min_order: 'Мин. сумма заказа',
  role_id: 'Роль',
  branch_id: 'Филиал',
  branch_ids: 'Доступ к филиалам',
  blocked_until: 'Блокировка',
  permissions: 'Права',
  status: 'Статус',
  guest_name: 'Имя гостя',
  guest_count: 'Кол-во гостей',
  reserved_date: 'Дата брони',
  reserved_time: 'Время брони',
  table_id: 'Стол',
  category_id: 'Категория',
  expires_at: 'Срок действия',
  requires_kitchen: 'Готовка на кухне',
  is_bookable: 'Доступна к записи',
  nutrition: 'Пищевая ценность',
  ingredients: 'Состав',
  tags: 'Теги',
  addon_ids: 'Добавки',
  modifier_option_ids: 'Опции модификаторов',
  // настройки заведения (tenants)
  delivery_description: 'Описание доставки',
  delivery_mode: 'Режим доставки',
  free_delivery_from: 'Бесплатная доставка от',
  working_hours_schedule: 'График работы',
  timezone: 'Часовой пояс',
  currency: 'Валюта',
  menu_style: 'Стиль меню',
  branch_selection_mode: 'Выбор филиала',
  payment_methods: 'Способы оплаты',
  legal_info: 'Юр. информация',
  contacts: 'Контакты',
  custom_domain: 'Домен',
  modules: 'Модули',
  notifications: 'Уведомления',
  kitchen_urgency_minutes: 'Срочность кухни (мин)',
  kitchen_config: 'Настройки кухни',
  order_number_config: 'Нумерация заказов',
  order_scheduling_config: 'Предзаказы',
  max_addons_default: 'Макс. добавок по умолч.',
  theme: 'Тема',
  seo: 'SEO',
  site_layout: 'Макет сайта',
  site_content: 'Контент сайта',
  color_palettes: 'Палитры',
  orders_tile_size: 'Размер плиток заказов',
  // вложенные ключи jsonb — для развёрнутого diff'а
  calories: 'Калории',
  protein: 'Белки',
  fat: 'Жиры',
  carbs: 'Углеводы',
  delivery: 'Доставка',
  pickup: 'Самовывоз',
  modifiers: 'Модификаторы',
  addons: 'Добавки',
  promotions: 'Акции',
  combos: 'Комбо',
  customRoles: 'Кастомные роли',
  dineIn: 'Обслуживание на месте',
  kitchen: 'Кухня',
  customers: 'Клиенты',
  services: 'Услуги',
  branches: 'Филиалы',
  email: 'Email',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  instagram: 'Instagram',
  vk: 'VK',
  website: 'Сайт',
}

export const entityTypeLabel = (entityType: string): string => ENTITY_TYPE_LABELS[entityType] ?? entityType

export const actionMeta = (action: string): { label: string; tone: ActionTone } => ACTION_LABELS[action] ?? { label: action, tone: 'default' }

export const fieldLabel = (key: string): string => FIELD_LABELS[key] ?? key

// Узнаваемый текст значения поля для diff'а (true/false/пусто и т.п.)
export const formatFieldValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'да' : 'нет'
  if (Array.isArray(value)) return value.length ? `${value.length} шт.` : '—'
  if (typeof value === 'object') return '…'

  return String(value)
}

const isFieldDiff = (value: unknown): value is AuditLogFieldDiff => typeof value === 'object' && value !== null && 'old' in value && 'new' in value

// Денежные поля — для них показываем цветовое направление (рост/падение).
const PRICE_FIELDS = new Set(['price', 'delivery_fee', 'delivery_min_order', 'free_delivery_from'])

// jsonb-объект (не массив) — старое→новое осмысленно не показать, помечаем как complex.
const isPlainObject = (value: unknown): boolean => typeof value === 'object' && value !== null && !Array.isArray(value)

export type RenderedChange = {
  field: string
  label: string
  oldValue: string
  newValue: string
  // text — обычное old→new; price — денежное (цвет по direction); complex — jsonb, не развернули
  kind: 'text' | 'price' | 'complex'
  // для price: 'up' если выросло, 'down' если упало, иначе null
  direction: 'up' | 'down' | null
}

// Денежное направление по числовым old/new.
const priceDirection = (oldRaw: unknown, newRaw: unknown): 'up' | 'down' | null => {
  const o = Number(oldRaw)
  const n = Number(newRaw)

  if (Number.isFinite(o) && Number.isFinite(n) && o !== n) return n > o ? 'up' : 'down'

  return null
}

const deepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false

    return a.every((v, i) => deepEqual(v, b[i]))
  }

  const ak = Object.keys(a as object)
  const bk = Object.keys(b as object)

  if (ak.length !== bk.length) return false

  return ak.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}

const MAX_LEAVES = 8

// Разворачивает jsonb-объект в плоские листья по изменившимся ключам (рекурсивно, до 2 уровней).
// Листья, где обе стороны нечитаемы («… → …»), пропускаются. Останавливается на MAX_LEAVES+1.
const collectLeaves = (
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
  pathKey: string,
  pathLabel: string,
  depth: number,
  out: RenderedChange[],
): void => {
  const keys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)])

  for (const key of keys) {
    if (out.length > MAX_LEAVES) return

    const o = oldObj[key]
    const n = newObj[key]

    if (deepEqual(o, n)) continue

    const childKey = `${pathKey}.${key}`
    const childLabel = `${pathLabel} › ${fieldLabel(key)}`

    if (depth < 2 && isPlainObject(o) && isPlainObject(n)) {
      collectLeaves(o as Record<string, unknown>, n as Record<string, unknown>, childKey, childLabel, depth + 1, out)
      continue
    }

    const oldValue = formatFieldValue(o)
    const newValue = formatFieldValue(n)

    // оба значения нечитаемы (вложенный объект на пределе глубины) — пропускаем, не мусорим «… → …»
    if (oldValue === '…' && newValue === '…') continue

    const isPrice = PRICE_FIELDS.has(key)

    out.push({
      field: childKey,
      label: childLabel,
      oldValue,
      newValue,
      kind: isPrice ? 'price' : 'text',
      direction: isPrice ? priceDirection(o, n) : null,
    })
  }
}

// Превращает changed_fields + payload в готовые к рендеру строки изменений.
// jsonb-поля разворачиваются в значимые листья; огромные/непрозрачные блобы остаются «изменено».
export const renderChanges = (log: Pick<AuditLog, 'changedFields' | 'payload'>): RenderedChange[] => {
  const out: RenderedChange[] = []

  for (const key of log.changedFields ?? []) {
    if (key === 'deleted_at' || key === 'archived_at') continue

    const diff = log.payload?.[key]
    const oldRaw = isFieldDiff(diff) ? diff.old : undefined
    const newRaw = isFieldDiff(diff) ? diff.new : undefined

    if (PRICE_FIELDS.has(key)) {
      out.push({ field: key, label: fieldLabel(key), oldValue: formatFieldValue(oldRaw), newValue: formatFieldValue(newRaw), kind: 'price', direction: priceDirection(oldRaw, newRaw) })
      continue
    }

    if (isPlainObject(oldRaw) || isPlainObject(newRaw)) {
      const leaves: RenderedChange[] = []

      collectLeaves(
        isPlainObject(oldRaw) ? oldRaw as Record<string, unknown> : {},
        isPlainObject(newRaw) ? newRaw as Record<string, unknown> : {},
        key,
        fieldLabel(key),
        0,
        leaves,
      )

      // ничего значимого не нашли или слишком много изменений — не разворачиваем
      if (leaves.length === 0 || leaves.length > MAX_LEAVES) {
        out.push({ field: key, label: fieldLabel(key), oldValue: '…', newValue: '…', kind: 'complex', direction: null })
      } else {
        out.push(...leaves)
      }

      continue
    }

    out.push({ field: key, label: fieldLabel(key), oldValue: formatFieldValue(oldRaw), newValue: formatFieldValue(newRaw), kind: 'text', direction: null })
  }

  return out
}
