export type OnboardingLabels = {
  menu: string // 'Меню' / 'Каталог' / 'Услуги'
  menuPurpose: string // 'меню' / 'каталог' / 'список услуг'
  item: string // 'блюдо' / 'товар' / 'услуга'
  itemAcc: string // 'блюдо' / 'товар' / 'услугу'
  firstItemAcc: string // 'первое блюдо' / 'первый товар' / 'первую услугу'
  categoryExamples: string // «Пицца»... / «Одежда»... / «Стрижка»...
}

export type OnboardingStep = {
  id: string
  title: string
  description: string
  details?: string[]
  ctaLabel?: string
  route?: string
  /** Открывать внешний URL (а не роут внутри админки). `storefront` — открыть витрину тенанта. */
  externalTarget?: 'storefront'
  /** ID тура (driver.js) для иконки-шапочки у заголовка */
  tourId?: string
  /** Путь в базе знаний (относительно help-host) для иконки-шапочки */
  kbRoute?: string
}

// ============================================================================
// Шаги приёма заказов — по одному на активный модуль.
// ============================================================================

const deliveryStep: OnboardingStep = {
  id: 'intake-delivery',
  title: 'Настройте доставку',
  description: 'Выберите, как считается стоимость: фикс на весь город или зоны на карте — у каждой свои условия.',
  details: [
    'Откройте «Заказы → Доставка»',
    'Вариант 1 — фиксированная стоимость: одна цена на всю доставку',
    'Вариант 2 — нарисуйте зоны на карте и для каждой задайте стоимость, минимальный заказ и порог бесплатной доставки',
    'Не забудьте указать минимальный заказ и сумму, от которой доставка бесплатная',
  ],
  ctaLabel: 'Открыть доставку',
  route: '/orders/delivery',
  kbRoute: '/orders',
  tourId: 'delivery',
}

const pickupStep: OnboardingStep = {
  id: 'intake-pickup',
  title: 'Настройте самовывоз',
  description: 'Адрес точки и часы работы. Настройки общие для всего заведения — при необходимости их можно переопределить по филиалам.',
  details: [
    'В разделе «Заведение» укажите адрес, телефон и часы работы',
    'Если филиалов несколько — у каждого можно задать свой адрес и переопределить часы',
  ],
  ctaLabel: 'Открыть заведение',
  route: '/branches',
  kbRoute: '/branches',
}

const dineInStep: OnboardingStep = {
  id: 'intake-dine-in',
  title: 'Настройте заказ в зале',
  description: 'Столы с QR-кодами, план зала, вызовы официанта.',
  details: [
    'Откройте «Столы» и добавьте столы',
    'Получите QR-коды и распечатайте для каждого стола',
    'По желанию — настройте типы вызовов официанта',
  ],
  ctaLabel: 'Открыть столы',
  route: '/tables',
  kbRoute: '/tables',
}

const appointmentsStep: OnboardingStep = {
  id: 'appointments',
  title: 'Добавьте первого исполнителя или объект',
  description:
    'Онлайн-запись работает через ресурсы — это могут быть мастера и тренеры, либо объекты вроде бильярдного стола, корта, кабинета. Настройте расписание, и клиенты смогут выбирать время прямо с витрины.',
  details: [
    'Откройте «Онлайн-запись → Сотрудники» (или «Объекты»)',
    'Нажмите «Добавить» и введите имя или название',
    'Задайте рабочие дни и часы работы',
    'Привяжите услуги, на которые ведётся запись',
  ],
  ctaLabel: 'Открыть сотрудников',
  route: '/appointments/staff',
  kbRoute: '/appointments',
}

// ============================================================================
// Остальные шаги — одинаковы для всех типов бизнеса (тексты локализуются через
// labels).
// ============================================================================

const categoryStep = (l: OnboardingLabels, isServices: boolean): OnboardingStep => ({
  id: 'category',
  title: 'Создайте первую категорию',
  description:
    `Чтобы начать продавать, нужно заполнить ${l.menuPurpose} — именно его увидят клиенты на витрине. ${l.menu} делится на категории: ${l.categoryExamples}.`,
  details: [
    `Откройте раздел «${l.menu} → Категории»`,
    'Нажмите «Добавить» и задайте название',
    'По желанию — загрузите обложку',
  ],
  ctaLabel: 'Создать категорию',
  // services-тенанты идут в /services/categories — /menu/* у них закрыт гейтом.
  route: isServices ? '/services/categories' : '/menu/categories',
  kbRoute: isServices ? '/services' : '/menu',
  tourId: 'create-category',
})

const itemStep = (l: OnboardingLabels, isServices: boolean): OnboardingStep => ({
  id: 'item',
  title: `Добавьте ${l.firstItemAcc}`,
  description: isServices
    ? `Отлично, категория есть. Теперь наполним её. Услуга — это позиция каталога, которую клиент выбирает при записи или заказе. Начните с одной позиции.`
    : `Отлично, категория есть. Теперь наполним её. ${l.item.charAt(0).toUpperCase() + l.item.slice(1)} — это то, что клиент кладёт в корзину. Начните с одной позиции.`,
  details: [
    `Откройте раздел «${l.menu}» и нажмите «Добавить»`,
    'Заполните название, цену и выберите категорию',
    isServices
      ? 'Добавьте фото — это помогает клиентам понять, чего ожидать'
      : 'Обязательно добавьте фото — оно сильнее всего влияет на решение о покупке',
  ],
  ctaLabel: `Добавить ${l.itemAcc}`,
  route: isServices ? '/services/items' : '/menu/dishes',
  kbRoute: isServices ? '/services' : '/menu',
  tourId: 'create-dish',
})

const legalStep: OnboardingStep = {
  id: 'legal',
  title: 'Заполните юридические данные',
  description:
    'Без этих данных закон запрещает обрабатывать персональные данные клиентов — значит, приём заказов и бронирований будет недоступен. Заполнение занимает пару минут.',
  details: [
    'Откройте «Настройки → Юридические»',
    'Укажите юр. наименование, ИНН, ОГРН/ОГРНИП и юридический адрес',
    'Добавьте email для обращений по персональным данным',
    'По желанию прикрепите PDF с офертой для клиентов',
  ],
  ctaLabel: 'Открыть юр. данные',
  route: '/settings/legal',
  kbRoute: '/settings',
}

const statusesStep: OnboardingStep = {
  id: 'statuses',
  title: 'Проверьте статусы заказов',
  description:
    'Заказ проходит путь: «Новый → Готовится → Выдан». Базовый набор уже создан — имеет смысл заглянуть и подогнать под свой процесс.',
  details: [
    'Откройте «Заказы → Статусы» и посмотрите цепочку',
    'Переименуйте, добавьте или удалите статусы под свои этапы',
  ],
  ctaLabel: 'Открыть статусы',
  route: '/orders/statuses',
  kbRoute: '/orders',
  tourId: 'order-statuses',
}

const siteStep: OnboardingStep = {
  id: 'site',
  title: 'Оформите витрину',
  description:
    'Витрина — это лицо вашего заведения. Настройте цвета, логотип, баннер и контакты в футере — чтобы не смотрелось безлико.',
  details: [
    'Выберите цветовую схему под ваш бренд',
    'Загрузите логотип и настройте главный экран',
    'В разделе «Заведение» заполните телефон, в «Настройках → Общее» — соцсети',
  ],
  ctaLabel: 'Открыть сайт',
  route: '/appearance',
  kbRoute: '/appearance',
}

const testOrderStep: OnboardingStep = {
  id: 'test-order',
  title: 'Сделайте тестовый заказ',
  description:
    'Финальная проверка. Оформите заказ сами через витрину — так увидите, всё ли работает: от добавления в корзину до появления в админке.',
  details: [
    'Откройте витрину в новой вкладке',
    'Оформите заказ как обычный клиент',
    'Убедитесь, что заказ появился в «Заказах»',
  ],
  ctaLabel: 'Открыть витрину',
  externalTarget: 'storefront',
  kbRoute: '/orders',
  tourId: 'orders',
}

const reservationsStep: OnboardingStep = {
  id: 'reservations',
  title: 'Настройте бронирование столиков',
  description:
    'Гости смогут бронировать столик прямо с витрины. Без расписания работы слоты недоступны — начните с него.',
  details: [
    'Убедитесь, что в разделе «Заведение» заполнены часы работы — без них броней не будет',
    'Откройте «Бронирования → Настройки» и задайте шаг слотов (15, 30 или 60 минут)',
    'Укажите, на сколько дней вперёд принимаются брони и максимум гостей на одну запись',
  ],
  ctaLabel: 'Открыть настройки бронирований',
  route: '/reservations/settings',
  kbRoute: '/reservations',
}

const testBookingStep: OnboardingStep = {
  id: 'test-order',
  title: 'Проверьте форму записи',
  description:
    'Финальная проверка. Пройдите путь клиента сами — убедитесь, что запись оформляется и заявка появляется в системе.',
  details: [
    'Откройте витрину в новой вкладке',
    'Выберите услугу и оформите запись',
    'Убедитесь, что заявка появилась в разделе «Записи»',
  ],
  ctaLabel: 'Открыть витрину',
  externalTarget: 'storefront',
  kbRoute: '/reservations',
}

export const buildOnboardingFlow = (
  l: OnboardingLabels,
  ctx: { isServices: boolean; modules: { delivery: boolean; pickup: boolean; dineIn: boolean; reservations: boolean; services: boolean } },
): OnboardingStep[] => {
  const steps: OnboardingStep[] = [categoryStep(l, ctx.isServices), itemStep(l, ctx.isServices)]
  const { delivery, pickup, dineIn, reservations, services } = ctx.modules
  const hasOrders = delivery || pickup || dineIn
  const hasPersonalData = (ctx.isServices && services) || hasOrders || reservations

  if (ctx.isServices) {
    // Шаг настройки приёма записей (intakeServicesStep) удалён — он вёл на
    // /settings/modules уже после включения модуля и ничего полезного не давал.
    // Сразу переходим к добавлению ресурса (исполнителя или объекта).
    if (services) steps.push(appointmentsStep)
  } else {
    if (delivery) steps.push(deliveryStep)
    if (pickup) steps.push(pickupStep)
    if (dineIn) steps.push(dineInStep)
    if (reservations) steps.push(reservationsStep)
  }

  if (hasPersonalData) steps.push(legalStep)
  if (hasOrders) steps.push(statusesStep)
  steps.push(siteStep)
  if (ctx.isServices && services) steps.push(testBookingStep)
  else if (hasOrders) steps.push(testOrderStep)

  return steps
}
