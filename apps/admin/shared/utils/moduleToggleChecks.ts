import type { SiteLayout } from '@fastio/shared'
import { SITE_FEATURES } from '@fastio/shared'
import type { ModuleKey } from '~/config/modules'
import type { useDatabase } from '~/shared/data/useDatabase'
import { RESERVATION_ACTIVE_STATUSES } from '~/features/reservations'

export type ToggleIssue = {
  severity: 'blocker' | 'warning'
  message: string
}

type Api = ReturnType<typeof useDatabase>

const getActiveOrderStatusIds = async (api: Api, tenantId: string): Promise<string[]> => {
  const statuses = await api.orderStatuses.list(tenantId)

  return statuses
    .filter((s) => s.groupType !== 'completed' && s.groupType !== 'cancelled')
    .map((s) => s.id)
}

const getSiteFeatureUsage = (key: string, layout: SiteLayout): string[] => {
  const feature = (SITE_FEATURES as Record<string, { label: string }>)[key]

  if (!feature) return []

  const usage: string[] = []

  if ((layout.sectionsOrder as string[]).includes(key)) {
    usage.push(`секция «${feature.label}»`)
  }
  if ((layout.pages as string[]).includes(key)) {
    usage.push(`страница «${feature.label}»`)
  }

  return usage
}

const findDependentFeatures = (moduleKey: ModuleKey, layout: SiteLayout): string[] => {
  const usage: string[] = []

  for (const [featureKey, def] of Object.entries(SITE_FEATURES) as [string, { module?: string; label: string }][]) {
    if (def.module === moduleKey) {
      usage.push(...getSiteFeatureUsage(featureKey, layout))
    }
  }

  return usage
}

export const checkModuleDisable = async (
  moduleKey: ModuleKey,
  tenantId: string,
  layout: SiteLayout,
  api: Api,
): Promise<ToggleIssue[]> => {
  const issues: ToggleIssue[] = []

  if (moduleKey === 'delivery') {
    const statusIds = await getActiveOrderStatusIds(api, tenantId)

    if (statusIds.length) {
      const { total } = await api.orders.list(tenantId, null, {
        statusIds,
        deliveryTypes: ['delivery'],
        pageSize: 0,
      })

      if (total > 0) {
        issues.push({
          severity: 'blocker',
          message: `Нельзя выключить: есть активные заказы на доставку (${total}). Завершите или отмените их в разделе Заказы.`,
        })
      }
    }
  }

  if (moduleKey === 'pickup') {
    const statusIds = await getActiveOrderStatusIds(api, tenantId)

    if (statusIds.length) {
      const { total } = await api.orders.list(tenantId, null, {
        statusIds,
        deliveryTypes: ['pickup'],
        pageSize: 0,
      })

      if (total > 0) {
        issues.push({
          severity: 'blocker',
          message: `Нельзя выключить: есть активные заказы на самовывоз (${total}). Завершите или отмените их в разделе Заказы.`,
        })
      }
    }
  }

  if (moduleKey === 'dineIn') {
    const tables = await api.tables.list(tenantId)
    const openCount = tables.filter((t) => t.isOpen).length

    if (openCount > 0) {
      issues.push({
        severity: 'blocker',
        message: `Нельзя выключить: есть открытые столы (${openCount}). Закройте их в разделе Столы.`,
      })
    }

    // Брони теперь часть модуля «Столы» — выключение dineIn гасит и их.
    const activeReservations = await api.reservations.list(tenantId, {
      statuses: RESERVATION_ACTIVE_STATUSES,
    })

    if (activeReservations.length > 0) {
      issues.push({
        severity: 'blocker',
        message: `Нельзя выключить: есть активные бронирования (${activeReservations.length}). Завершите или отмените их во вкладке «Столы → Бронирование».`,
      })
    }
  }

  if (moduleKey === 'customRoles') {
    const count = await api.members.countWithCustomRole(tenantId)

    if (count > 0) {
      issues.push({
        severity: 'blocker',
        message: `Нельзя выключить: у ${count} ${count === 1 ? 'сотрудника' : 'сотрудников'} назначены кастомные роли. Переведи их на стандартные роли в разделе Команда.`,
      })
    }
  }

  if (moduleKey === 'services') {
    const count = await api.appointments.countActiveFuture(tenantId)

    if (count > 0) {
      issues.push({
        severity: 'blocker',
        message: `Нельзя выключить: есть активные записи (${count}). Завершите или отмените их в разделе Записи.`,
      })
    }
  }

  if (moduleKey === 'kitchen') {
    const count = await api.kitchenQueue.countActive(tenantId)

    if (count > 0) {
      issues.push({
        severity: 'blocker',
        message: `Нельзя выключить: в очереди кухни есть незавершённые позиции (${count}). Дождись выполнения или очисти очередь.`,
      })
    }
  }

  if (moduleKey === 'promotions') {
    const banners = await api.banners.list(tenantId)
    const linked = banners.filter((b) => b.promotionId !== null)

    if (linked.length > 0) {
      issues.push({
        severity: 'warning',
        message: `Есть баннеры, привязанные к акциям (${linked.length}). После отключения модуля они перестанут работать. Отвяжите их в разделе Баннеры, если нужно.`,
      })
    }
  }

  if (moduleKey === 'combos') {
    const count = (await api.combos.listAllActive(tenantId)).length

    if (count > 0) {
      issues.push({
        severity: 'warning',
        message: `Есть активные комбо (${count}). После отключения модуля они пропадут с витрины и станут недоступны для заказа.`,
      })
    }
  }

  if (moduleKey === 'addons') {
    const count = (await api.addons.list(tenantId)).length

    if (count > 0) {
      issues.push({
        severity: 'warning',
        message: `Есть добавки (${count}). После отключения модуля они пропадут из карточек товаров на витрине.`,
      })
    }
  }

  if (moduleKey === 'modifiers') {
    const count = (await api.modifiers.list(tenantId)).length

    if (count > 0) {
      issues.push({
        severity: 'warning',
        message: `Есть группы модификаторов (${count}). После отключения модуля они пропадут из карточек товаров на витрине.`,
      })
    }
  }

  if (moduleKey === 'customers') {
    const count = await api.customers.count(tenantId)

    if (count > 0) {
      issues.push({
        severity: 'warning',
        message: `Зарегистрировано клиентов (${count}). После отключения модуля они потеряют доступ к личному кабинету на витрине.`,
      })
    }
  }

  // Site layout warnings for any module
  const siteUsage = findDependentFeatures(moduleKey, layout)

  if (siteUsage.length) {
    const list = siteUsage.join(', ')

    issues.push({
      severity: 'warning',
      message: `На сайте используется ${list}. После отключения модуля ${siteUsage.length > 1 ? 'они пропадут' : 'она пропадёт'} с сайта. Чтобы вернуть — включите модуль и добавьте заново в Внешний вид.`,
    })
  }

  return issues
}
