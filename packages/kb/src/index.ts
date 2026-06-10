import type { IconName } from '@fastio/icons'

export type KbArticle = {
  id: string
  title: string
  content: string
}

export type KbSection = {
  id: string
  title: string
  icon: IconName
  articles: KbArticle[]
}

// Структура без контента — каждое приложение импортирует markdown самостоятельно через ?raw
export type KbSectionMeta = {
  id: string
  title: string
  icon: IconName
  articles: { id: string; title: string; file: string }[]
}

// Маппинг маршрутов админки на разделы KB и AI-knowledge.
// Единственный источник истины — используется и AI-сервером, и хедером админки.
export type KbRoute = {
  /** префикс маршрута в admin, например '/menu' */
  route: string
  /** id секции в KB_STRUCTURE (null — только AI-knowledge, без публичной KB) */
  kbSection: string | null
  /** префикс имён файлов в packages/kb/content, например '02-menu' (null — нет публичной KB) */
  kbFilePrefix: string | null
  /** id секций в admin/server/ai/knowledge */
  aiSections: string[]
}

export const KB_ROUTES: KbRoute[] = [
  { route: '/dashboard', kbSection: 'dashboard',    kbFilePrefix: '01-dashboard',    aiSections: ['dashboard'] },
  { route: '/menu',      kbSection: 'menu',         kbFilePrefix: '02-menu',         aiSections: ['menu'] },
  { route: '/orders',    kbSection: 'orders',       kbFilePrefix: '03-orders',       aiSections: ['orders'] },
  { route: '/kitchen',   kbSection: 'kitchen',      kbFilePrefix: '04-kitchen',      aiSections: ['kitchen'] },
  // /tables/reservations ДО /tables — find(startsWith) иначе отдаст tables-секцию.
  { route: '/tables/reservations', kbSection: 'reservations', kbFilePrefix: '06-reservations', aiSections: ['reservations'] },
  { route: '/tables',    kbSection: 'tables',       kbFilePrefix: '05-tables',       aiSections: ['tables'] },
  { route: '/reservations', kbSection: 'reservations', kbFilePrefix: '06-reservations', aiSections: ['reservations'] },
  { route: '/promotions', kbSection: 'promotions',  kbFilePrefix: '07-promotions',   aiSections: ['promotions'] },
  { route: '/content',   kbSection: 'content',      kbFilePrefix: '08-content',      aiSections: ['content'] },
  { route: '/appearance', kbSection: 'appearance',  kbFilePrefix: '09-appearance',   aiSections: ['appearance'] },
  { route: '/settings',  kbSection: 'settings',     kbFilePrefix: '10-settings',     aiSections: ['settings'] },
  { route: '/team',      kbSection: 'team',         kbFilePrefix: '11-team',         aiSections: ['team'] },
  { route: '/account',   kbSection: 'account',      kbFilePrefix: '12-account',      aiSections: ['account'] },
  { route: '/appointments', kbSection: 'appointments', kbFilePrefix: '13-appointments', aiSections: ['appointments'] },
  { route: '/services',  kbSection: 'services',     kbFilePrefix: '14-services',     aiSections: ['services'] },
  { route: '/audit-log', kbSection: 'audit',        kbFilePrefix: '15-audit',        aiSections: ['audit'] },
  { route: '/help',      kbSection: null,           kbFilePrefix: null,              aiSections: ['support'] },
]

export const KB_STRUCTURE: KbSectionMeta[] = [
  {
    id: 'dashboard',
    title: 'Дашборд',
    icon: 'dashboard',
    articles: [
      { id: 'dashboard', title: 'Дашборд', file: '01-dashboard' },
    ],
  },
  {
    id: 'menu',
    title: 'Меню',
    icon: 'dishes',
    articles: [
      { id: 'menu-dishes', title: 'Блюда', file: '02-menu-dishes' },
      { id: 'menu-categories', title: 'Категории', file: '02-menu-categories' },
      { id: 'menu-modifiers', title: 'Модификаторы', file: '02-menu-modifiers' },
      { id: 'menu-addons', title: 'Добавки', file: '02-menu-addons' },
      { id: 'menu-tags', title: 'Теги', file: '02-menu-tags' },
    ],
  },
  {
    id: 'orders',
    title: 'Заказы',
    icon: 'orders',
    articles: [
      { id: 'orders-managing', title: 'Работа с заказами', file: '03-orders-managing' },
      { id: 'orders-statuses', title: 'Статусы заказов', file: '03-orders-statuses' },
      { id: 'orders-delivery', title: 'Зоны доставки', file: '03-orders-delivery' },
      { id: 'orders-numbering', title: 'Нумерация заказов', file: '03-orders-numbering' },
      { id: 'orders-preorders', title: 'Предзаказы', file: '03-orders-preorders' },
    ],
  },
  {
    id: 'kitchen',
    title: 'Кухня',
    icon: 'chefHat',
    articles: [
      { id: 'kitchen-queue', title: 'Очередь', file: '04-kitchen-queue' },
      { id: 'kitchen-assembly', title: 'Сборка', file: '04-kitchen-assembly' },
      { id: 'kitchen-settings', title: 'Настройки кухни', file: '04-kitchen-settings' },
    ],
  },
  {
    id: 'tables',
    title: 'Столы',
    icon: 'tableIcon',
    articles: [
      { id: 'tables-managing', title: 'Управление столами', file: '05-tables-managing' },
      { id: 'tables-layout', title: 'План зала', file: '05-tables-layout' },
      { id: 'tables-calls', title: 'Вызовы', file: '05-tables-calls' },
    ],
  },
  {
    id: 'reservations',
    title: 'Бронирование',
    icon: 'calendarCheck',
    articles: [
      { id: 'reservations-managing', title: 'Работа с бронированиями', file: '06-reservations-managing' },
      { id: 'reservations-settings', title: 'Настройки бронирований', file: '06-reservations-settings' },
    ],
  },
  {
    id: 'promotions',
    title: 'Акции и промокоды',
    icon: 'promotions',
    articles: [
      { id: 'promotions-creating', title: 'Создание акций', file: '07-promotions-creating' },
      { id: 'promotions-promo-codes', title: 'Промокоды', file: '07-promotions-promo-codes' },
    ],
  },
  {
    id: 'content',
    title: 'Контент сайта',
    icon: 'image',
    articles: [
      { id: 'content-banners', title: 'Баннеры', file: '08-content-banners' },
      { id: 'content-galleries', title: 'Галереи', file: '08-content-galleries' },
    ],
  },
  {
    id: 'appearance',
    title: 'Сайт',
    icon: 'palette',
    articles: [
      { id: 'appearance-sections', title: 'Секции', file: '09-appearance-sections' },
      { id: 'appearance-theme', title: 'Тема и шрифты', file: '09-appearance-theme' },
      { id: 'appearance-seo', title: 'SEO и аналитика', file: '09-appearance-seo' },
    ],
  },
  {
    id: 'settings',
    title: 'Настройки',
    icon: 'settings',
    articles: [
      { id: 'settings-contacts', title: 'Контакты и часы работы', file: '10-settings-contacts' },
      { id: 'settings-notifications', title: 'Уведомления', file: '10-settings-notifications' },
      { id: 'settings-legal', title: 'Юридические данные', file: '10-settings-legal' },
      { id: 'settings-modules', title: 'Модули', file: '10-settings-modules' },
    ],
  },
  {
    id: 'team',
    title: 'Команда',
    icon: 'users',
    articles: [
      { id: 'team-members', title: 'Участники', file: '11-team-members' },
      { id: 'team-roles', title: 'Роли и права', file: '11-team-roles' },
      { id: 'team-branches', title: 'Филиалы', file: '11-team-branches' },
    ],
  },
  {
    id: 'account',
    title: 'Аккаунт и биллинг',
    icon: 'creditCard',
    articles: [
      { id: 'account', title: 'Аккаунт и биллинг', file: '12-account' },
    ],
  },
  {
    id: 'appointments',
    title: 'Онлайн-запись',
    icon: 'calendarCheck',
    articles: [
      { id: 'appointments-managing', title: 'Работа с записями', file: '13-appointments-managing' },
      { id: 'appointments-resources', title: 'Исполнители и объекты', file: '13-appointments-resources' },
      { id: 'appointments-templates', title: 'Шаблоны расписаний', file: '13-appointments-templates' },
      { id: 'appointments-settings', title: 'Настройки записи', file: '13-appointments-settings' },
    ],
  },
  {
    id: 'services',
    title: 'Услуги',
    icon: 'briefcase',
    articles: [
      { id: 'services-items', title: 'Услуги', file: '14-services-items' },
      { id: 'services-categories', title: 'Категории услуг', file: '14-services-categories' },
      { id: 'services-tags', title: 'Теги услуг', file: '14-services-tags' },
      { id: 'services-settings', title: 'Настройки услуг', file: '14-services-settings' },
    ],
  },
  {
    id: 'audit',
    title: 'Журнал действий',
    icon: 'list',
    articles: [
      { id: 'audit-journal', title: 'Журнал действий', file: '15-audit-journal' },
    ],
  },
]
