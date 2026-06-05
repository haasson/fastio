import { KB_STRUCTURE, type KbSection } from '@fastio/kb'

import dashboard from '@fastio/kb/content/01-dashboard.md?raw'
import menuDishes from '@fastio/kb/content/02-menu-dishes.md?raw'
import menuCategories from '@fastio/kb/content/02-menu-categories.md?raw'
import menuModifiers from '@fastio/kb/content/02-menu-modifiers.md?raw'
import menuAddons from '@fastio/kb/content/02-menu-addons.md?raw'
import menuTags from '@fastio/kb/content/02-menu-tags.md?raw'
import ordersManaging from '@fastio/kb/content/03-orders-managing.md?raw'
import ordersStatuses from '@fastio/kb/content/03-orders-statuses.md?raw'
import ordersDelivery from '@fastio/kb/content/03-orders-delivery.md?raw'
import ordersNumbering from '@fastio/kb/content/03-orders-numbering.md?raw'
import ordersPreorders from '@fastio/kb/content/03-orders-preorders.md?raw'
import kitchenQueue from '@fastio/kb/content/04-kitchen-queue.md?raw'
import kitchenAssembly from '@fastio/kb/content/04-kitchen-assembly.md?raw'
import kitchenSettings from '@fastio/kb/content/04-kitchen-settings.md?raw'
import tablesManaging from '@fastio/kb/content/05-tables-managing.md?raw'
import tablesLayout from '@fastio/kb/content/05-tables-layout.md?raw'
import tablesCalls from '@fastio/kb/content/05-tables-calls.md?raw'
import reservationsManaging from '@fastio/kb/content/06-reservations-managing.md?raw'
import reservationsSettings from '@fastio/kb/content/06-reservations-settings.md?raw'
import promotionsCreating from '@fastio/kb/content/07-promotions-creating.md?raw'
import promotionsPromoCodes from '@fastio/kb/content/07-promotions-promo-codes.md?raw'
import contentBanners from '@fastio/kb/content/08-content-banners.md?raw'
import contentGalleries from '@fastio/kb/content/08-content-galleries.md?raw'
import appearanceSections from '@fastio/kb/content/09-appearance-sections.md?raw'
import appearanceTheme from '@fastio/kb/content/09-appearance-theme.md?raw'
import appearanceSeo from '@fastio/kb/content/09-appearance-seo.md?raw'
import settingsContacts from '@fastio/kb/content/10-settings-contacts.md?raw'
import settingsNotifications from '@fastio/kb/content/10-settings-notifications.md?raw'
import settingsLegal from '@fastio/kb/content/10-settings-legal.md?raw'
import settingsModules from '@fastio/kb/content/10-settings-modules.md?raw'
import teamMembers from '@fastio/kb/content/11-team-members.md?raw'
import teamRoles from '@fastio/kb/content/11-team-roles.md?raw'
import teamBranches from '@fastio/kb/content/11-team-branches.md?raw'
import account from '@fastio/kb/content/12-account.md?raw'

const CONTENT: Record<string, string> = {
  '01-dashboard': dashboard,
  '02-menu-dishes': menuDishes,
  '02-menu-categories': menuCategories,
  '02-menu-modifiers': menuModifiers,
  '02-menu-addons': menuAddons,
  '02-menu-tags': menuTags,
  '03-orders-managing': ordersManaging,
  '03-orders-statuses': ordersStatuses,
  '03-orders-delivery': ordersDelivery,
  '03-orders-numbering': ordersNumbering,
  '03-orders-preorders': ordersPreorders,
  '04-kitchen-queue': kitchenQueue,
  '04-kitchen-assembly': kitchenAssembly,
  '04-kitchen-settings': kitchenSettings,
  '05-tables-managing': tablesManaging,
  '05-tables-layout': tablesLayout,
  '05-tables-calls': tablesCalls,
  '06-reservations-managing': reservationsManaging,
  '06-reservations-settings': reservationsSettings,
  '07-promotions-creating': promotionsCreating,
  '07-promotions-promo-codes': promotionsPromoCodes,
  '08-content-banners': contentBanners,
  '08-content-galleries': contentGalleries,
  '09-appearance-sections': appearanceSections,
  '09-appearance-theme': appearanceTheme,
  '09-appearance-seo': appearanceSeo,
  '10-settings-contacts': settingsContacts,
  '10-settings-notifications': settingsNotifications,
  '10-settings-legal': settingsLegal,
  '10-settings-modules': settingsModules,
  '11-team-members': teamMembers,
  '11-team-roles': teamRoles,
  '11-team-branches': teamBranches,
  '12-account': account,
}

export const KB_SECTIONS: KbSection[] = KB_STRUCTURE.map((section) => ({
  ...section,
  articles: section.articles.map((article) => ({
    id: article.id,
    title: article.title,
    content: CONTENT[article.file] ?? '',
  })),
}))
