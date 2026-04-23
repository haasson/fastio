import type { TenantModules } from '@fastio/shared'

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
  description: 'Зоны на карте, стоимость, минимальный заказ.',
  details: [
    'Откройте «Заказы → Доставка»',
    'Добавьте зоны — либо единую стоимость, либо полигоны',
    'Укажите минимальный заказ и бесплатную доставку от суммы',
  ],
  ctaLabel: 'Открыть доставку',
  route: '/orders/delivery',
  kbRoute: '/orders',
  tourId: 'delivery',
}

const pickupStep: OnboardingStep = {
  id: 'intake-pickup',
  title: 'Настройте самовывоз',
  description: 'Адрес филиала, часы работы, время подготовки заказа.',
  details: [
    'Откройте «Настройки → Модули» и убедитесь что самовывоз включён',
    'В «Настройках» заполните адрес и часы работы филиала',
  ],
  ctaLabel: 'Открыть настройки',
  route: '/settings/modules',
  kbRoute: '/settings',
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

const intakeServicesStep: OnboardingStep = {
  id: 'intake-services',
  title: 'Настройте приём записей',
  description:
    'Решите, как клиенты будут записываться: онлайн-бронирование, заявка на обратный звонок или ручное подтверждение.',
  ctaLabel: 'Открыть модули',
  route: '/settings/modules',
  kbRoute: '/settings',
}

// ============================================================================
// Остальные шаги — одинаковы для всех типов бизнеса (тексты локализуются через
// labels).
// ============================================================================

const categoryStep = (l: OnboardingLabels): OnboardingStep => ({
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
  route: '/menu/categories',
  kbRoute: '/menu',
  tourId: 'create-category',
})

const itemStep = (l: OnboardingLabels): OnboardingStep => ({
  id: 'item',
  title: `Добавьте ${l.firstItemAcc}`,
  description:
    `Отлично, категория есть. Теперь наполним её. ${l.item.charAt(0).toUpperCase() + l.item.slice(1)} — это то, что клиент кладёт в корзину. Начните с одной позиции.`,
  details: [
    `Откройте раздел «${l.menu}» и нажмите «Добавить»`,
    'Заполните название, цену и выберите категорию',
    'Обязательно добавьте фото — оно сильнее всего влияет на решение о покупке',
  ],
  ctaLabel: `Добавить ${l.itemAcc}`,
  route: '/menu/dishes',
  kbRoute: '/menu',
  tourId: 'create-dish',
})

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
    'В «Настройках → Контакты» заполните телефон и соцсети',
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
    'Ссылка на витрину — в шапке админки',
    'Оформите заказ как обычный клиент',
    'Убедитесь, что заказ появился в «Заказах»',
  ],
  ctaLabel: 'Открыть заказы',
  route: '/orders',
  kbRoute: '/orders',
  tourId: 'orders',
}

export const buildOnboardingFlow = (
  l: OnboardingLabels,
  ctx: { isServices: boolean; modules: TenantModules | null },
): OnboardingStep[] => {
  const steps: OnboardingStep[] = [categoryStep(l), itemStep(l)]

  if (ctx.isServices) {
    steps.push(intakeServicesStep)
  } else {
    const m = ctx.modules

    if (m?.delivery) steps.push(deliveryStep)
    if (m?.pickup) steps.push(pickupStep)
    if (m?.dineIn) steps.push(dineInStep)
  }

  steps.push(statusesStep, siteStep, testOrderStep)

  return steps
}
