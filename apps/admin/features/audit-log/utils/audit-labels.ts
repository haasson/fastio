// Русскоязычный слой для журнала аудита.
// В БД хранятся латинские коды (entity_type, action, ключи полей), здесь — их русские
// названия для UI. Так фильтры стабильны, а интерфейс на русском.

import type { AuditLog, AuditLogFieldDiff } from '@fastio/shared'
import { formatDateTime } from '@fastio/shared'

// Полный ISO-таймстемп (с временем) — чтобы в diff'е показать его человечно,
// а не сырым `2026-06-10T04:20:35.911247+00:00`. Голые даты (`2026-06-10`) — мимо.
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

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
  order: 'Заказ',
}

// Группировка типов сущностей по разделам — для сгруппированного фильтра «Объект».
// «Столы» — retail-only (целиком скрыта у services гейтингом страницы);
// branch — отдельная группа: филиалы есть у обеих вертикалей.
export const ENTITY_TYPE_GROUPS: { label: string; types: string[] }[] = [
  { label: 'Меню', types: ['dish', 'category', 'modifier_group', 'modifier_option', 'addon', 'addon_preset', 'combo', 'combo_item', 'dish_tag'] },
  { label: 'Столы', types: ['table', 'reservation'] },
  { label: 'Услуги', types: ['service'] },
  { label: 'Маркетинг', types: ['promo_code', 'promotion'] },
  { label: 'Команда', types: ['role', 'member', 'invitation'] },
  { label: 'Филиалы', types: ['branch'] },
  { label: 'Настройки', types: ['settings'] },
  { label: 'Заказы', types: ['order'] },
]

// ─── Действия ─────────────────────────────────────────────────────
// Только конфиг-действия (БД-триггеры). Order-события (status_changed и т.п.) сюда
// не попадают — их отображение идёт через summary в journal-row.
export const ACTION_LABELS: Record<string, { label: string; tone: ActionTone }> = {
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
  // филиалы (branches)
  working_hours: 'График работы',
  address_data: 'Данные адреса',
  order_number_prefix: 'Префикс номера заказа',
  // брони (reservations)
  customer_id: 'Клиент',
  guest_phone: 'Телефон гостя',
  guest_email: 'Email гостя',
  comment: 'Комментарий',
  table_name: 'Название стола',
  order_id: 'Заказ',
  confirmed_by: 'Кем подтверждено',
  confirmed_at: 'Подтверждено',
  seated_at: 'Гости посажены',
  cancelled_at: 'Отменено',
  cancel_reason: 'Причина отмены',
  completed_at: 'Завершено',
  // столы (tables)
  opened_at: 'Открыт',
  position_x: 'Позиция X',
  position_y: 'Позиция Y',
  shape: 'Форма',
  table_width: 'Ширина',
  table_height: 'Высота',
  rotation: 'Поворот',
  notes: 'Заметки',
  // категории
  slug: 'Ссылка (slug)',
  tag_id: 'Тег',
  type: 'Тип',
  // промокоды и акции
  discount_type: 'Тип скидки',
  discount_value: 'Размер скидки',
  usage_limit: 'Лимит применений',
  used_count: 'Применений',
  active_from: 'Активен с',
  active_to: 'Активен до',
  min_order_amount: 'Мин. сумма заказа',
  banner_url: 'Баннер',
  conditions: 'Условия',
  // модификаторы и комбо
  weight_delta: 'Изменение веса',
  group_id: 'Группа модификаторов',
  combo_id: 'Комбо',
  dish_id: 'Блюдо',
  // команда и доступ
  user_id: 'Пользователь',
  invited_by: 'Кем приглашён',
  accepted_at: 'Принято',
  is_default: 'Роль по умолчанию',
}

export const entityTypeLabel = (entityType: string): string => ENTITY_TYPE_LABELS[entityType] ?? entityType

export const actionMeta = (action: string): { label: string; tone: ActionTone } => ACTION_LABELS[action] ?? { label: action, tone: 'default' }

export const fieldLabel = (key: string): string => FIELD_LABELS[key] ?? key

// Значения enum-полей: латинские коды → русский. Ключ — имя поля; при конфликте
// одинаковых имён с разными доменами (напр. `type` у категории и акции) — ключ
// `${entityType}.${field}`. Резолвер сначала ищет scoped-ключ, потом плоский.
const ENUM_VALUE_LABELS: Record<string, Record<string, string>> = {
  // reservations.status
  'status': {
    pending: 'Ожидает',
    confirmed: 'Подтверждена',
    seated: 'Гости за столом',
    completed: 'Завершена',
    cancelled: 'Отменена',
    no_show: 'Не пришли',
  },
  // tables.shape
  'shape': { rectangle: 'Прямоугольный', circle: 'Круглый' },
  // promo_codes / promotions discount_type (домены идентичны)
  'discount_type': { percent: 'Процент', fixed: 'Фиксированная' },
  // настройки заведения (tenants)
  'menu_style': { food: 'Еда', catalog: 'Каталог' },
  'branch_selection_mode': { unified: 'Общий выбор', per_branch: 'По филиалам' },
  'delivery_mode': { fixed: 'Фиксированная', zones: 'По зонам' },
  'orders_tile_size': { s: 'Маленький', m: 'Средний', l: 'Большой' },
  // `type` — конфликт доменов, поэтому ключи scoped по entity_type
  'category.type': { regular: 'Обычная', combo: 'Комбо' },
  'promotion.type': {
    min_order: 'Минимальная сумма',
    happy_hour: 'Счастливые часы',
    weekday: 'День недели',
    first_order: 'Первый заказ',
    free_item: 'Подарок',
  },
}

const enumValueLabel = (entityType: string | undefined, field: string, value: string): string | null => {
  const scoped = entityType ? ENUM_VALUE_LABELS[`${entityType}.${field}`] : undefined

  return scoped?.[value] ?? ENUM_VALUE_LABELS[field]?.[value] ?? null
}

// Узнаваемый текст значения поля для diff'а (true/false/пусто, enum→рус и т.п.).
// field/entityType нужны для перевода enum-значений (status, shape, type и т.д.).
export const formatFieldValue = (value: unknown, field?: string, entityType?: string): string => {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'да' : 'нет'
  if (Array.isArray(value)) return value.length ? `${value.length} шт.` : '—'
  if (typeof value === 'object') return '…'

  if (typeof value === 'string') {
    if (field) {
      const label = enumValueLabel(entityType, field, value)

      if (label) return label
    }

    if (ISO_DATETIME.test(value)) return formatDateTime(value)
  }

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
  // text — обычное old→new; price — денежное (цвет по direction); complex — jsonb, не развернули;
  // phrase — готовая человеческая фраза (рендерим только label, без old→new)
  kind: 'text' | 'price' | 'complex' | 'phrase'
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
  entityType: string | undefined,
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
      collectLeaves(o as Record<string, unknown>, n as Record<string, unknown>, childKey, childLabel, depth + 1, entityType, out)
      continue
    }

    const oldValue = formatFieldValue(o, key, entityType)
    const newValue = formatFieldValue(n, key, entityType)

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

// Поля, дублирующие колонки журнала, — в diff'е это шум, прячем:
// • *_at момента действия (confirmed_at/seated_at/…) = колонка «Дата»;
// • actor-id действия (confirmed_by/invited_by) = колонка «Сотрудник» (+ это сырой UUID).
// НЕ входят: expires_at/active_from/active_to/blocked_until/reserved_* — это данные, не момент действия.
const REDUNDANT_WITH_COLUMNS = new Set([
  'confirmed_at', 'seated_at', 'cancelled_at', 'completed_at', 'accepted_at', 'opened_at',
  'confirmed_by', 'invited_by',
])

// Превращает changed_fields + payload в готовые к рендеру строки изменений.
// jsonb-поля разворачиваются в значимые листья; огромные/непрозрачные блобы остаются «изменено».
export const renderChanges = (log: Pick<AuditLog, 'entityType' | 'changedFields' | 'payload'>): RenderedChange[] => {
  const out: RenderedChange[] = []
  const entityType = log.entityType
  const fields = log.changedFields ?? []

  // Открытие/закрытие стола: RPC меняет is_open + opened_at разом. Показываем
  // человеческую фразу «Стол открыт/закрыт», а не «Открыт: да → нет» + сырой таймстемп
  // (дата уже есть в колонке события). Остальные правки стола (если были в этом же
  // апдейте) рендерим как обычно.
  let openCloseHandled = false

  if (entityType === 'table' && fields.includes('is_open')) {
    const diff = log.payload?.['is_open']
    const opened = isFieldDiff(diff) ? diff.new === true : undefined

    if (opened !== undefined) {
      out.push({ field: 'is_open', label: opened ? 'Стол открыт' : 'Стол закрыт', oldValue: '', newValue: '', kind: 'phrase', direction: null })
      openCloseHandled = true
    }
  }

  for (const key of fields) {
    if (key === 'deleted_at' || key === 'archived_at') continue
    // Шум, дублирующий колонки «Дата»/«Сотрудник» (opened_at тоже здесь).
    if (REDUNDANT_WITH_COLUMNS.has(key)) continue
    // is_open уже отражён фразой «Стол открыт/закрыт» выше
    if (openCloseHandled && key === 'is_open') continue

    const diff = log.payload?.[key]
    const oldRaw = isFieldDiff(diff) ? diff.old : undefined
    const newRaw = isFieldDiff(diff) ? diff.new : undefined

    if (PRICE_FIELDS.has(key)) {
      out.push({ field: key, label: fieldLabel(key), oldValue: formatFieldValue(oldRaw, key, entityType), newValue: formatFieldValue(newRaw, key, entityType), kind: 'price', direction: priceDirection(oldRaw, newRaw) })
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
        entityType,
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

    out.push({ field: key, label: fieldLabel(key), oldValue: formatFieldValue(oldRaw, key, entityType), newValue: formatFieldValue(newRaw, key, entityType), kind: 'text', direction: null })
  }

  return out
}
