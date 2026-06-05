<template>
  <div class="page-root">
    <header class="header">
      <span class="subtitle">Тарифные планы</span>
      <NButton type="primary" @click="openCreate">Создать тариф</NButton>
    </header>

    <main class="content">
      <div v-for="group in planGroups" :key="group.type" class="group">
        <div class="group-title">{{ group.label }}</div>
        <NDataTable
          :columns="columns"
          :data="group.plans"
          :loading="pending"
          :bordered="false"
          striped
        />
      </div>
    </main>

    <!-- Billing config -->
    <section class="card">
      <h3 class="card-title">Настройки биллинга</h3>
      <div class="row-form">
        <span class="form-label">Grace period (дней до блокировки)</span>
        <NInputNumber
          v-model:value="gracePeriod"
          :min="1"
          :max="30"
          style="width: 120px"
        />
      </div>
      <div class="row-form">
        <span class="form-label">Trial period (дней бесплатного периода)</span>
        <NInputNumber
          v-model:value="trialDays"
          :min="1"
          :max="30"
          style="width: 120px"
        />
      </div>
      <div class="row-form">
        <NButton
          type="primary"
          :loading="savingConfig"
          :disabled="gracePeriod === originalGracePeriod && trialDays === originalTrialDays"
          @click="saveConfig"
        >
          Сохранить
        </NButton>
      </div>
    </section>

    <NModal
      v-model:show="modalOpen"
      preset="card"
      :title="editing ? 'Редактировать тариф' : 'Создать тариф'"
      style="width: 760px"
    >
      <NForm
        ref="formRef"
        :model="form"
        :rules="rules"
        label-placement="top"
        @submit.prevent="submit"
      >
        <div class="form-grid">
          <NFormItem label="Тип бизнеса" path="business_type" class="span-2">
            <NSelect
              v-model:value="form.business_type"
              :disabled="!!editing"
              :options="[
                { label: 'Магазины и рестораны (retail)', value: 'retail' },
                { label: 'Услуги и запись (services)', value: 'services' },
              ]"
            />
          </NFormItem>

          <NFormItem label="Ключ (key)" path="key">
            <NInput v-model:value="form.key" :disabled="!!editing" placeholder="retail-start" />
          </NFormItem>
          <NFormItem label="Название" path="name">
            <NInput v-model:value="form.name" placeholder="Старт" />
          </NFormItem>

          <NFormItem label="Цена (₽/мес)" path="price">
            <NInputNumber v-model:value="form.price" :min="0" style="width: 100%" />
          </NFormItem>
          <div class="form-row-inline">
            <NFormItem label="Порядок" path="sort_order" style="width: 120px">
              <NInputNumber v-model:value="form.sort_order" :min="0" style="width: 100%" />
            </NFormItem>
            <NFormItem label="Активен" style="padding-top: 2px">
              <NSwitch v-model:value="form.is_active" />
            </NFormItem>
          </div>

          <NFormItem label="Описание" path="description" class="span-2">
            <NInput v-model:value="form.description" type="textarea" :rows="2" />
          </NFormItem>

          <NFormItem label="Бейдж (лендинг)" path="badge">
            <NInput v-model:value="form.badge" placeholder="Популярный" clearable />
          </NFormItem>
          <NFormItem label="Выделенный (featured)" style="padding-top: 2px">
            <NSwitch v-model:value="form.is_featured" />
          </NFormItem>
        </div>

        <!-- Features section -->
        <div class="features-section">
          <div class="features-header">
            <span class="features-title">Функции</span>
            <span class="features-hint">Что этот тариф ДОБАВЛЯЕТ (унаследованное ниже серым)</span>
          </div>

          <!-- Inherited (read-only) -->
          <div v-if="inheritedLabels.length > 0" class="inherited-row">
            <span class="inherited-label">Унаследовано:</span>
            <div class="inherited-tags">
              <NTag
                v-for="label in inheritedLabels"
                :key="label"
                size="small"
                :bordered="false"
                class="inherited-tag"
              >
                {{ label }}
              </NTag>
            </div>
          </div>

          <!-- Modules -->
          <div class="features-group-title">Модули</div>
          <div class="features-cols">
            <template v-if="form.business_type === 'retail'">
              <NCheckbox v-model:checked="form.features.modules.delivery" :disabled="isInherited('modules.delivery')">Доставка</NCheckbox>
              <NCheckbox v-model:checked="form.features.modules.pickup" :disabled="isInherited('modules.pickup')">Самовывоз</NCheckbox>
              <NCheckbox v-model:checked="form.features.modules.modifiers" :disabled="isInherited('modules.modifiers')">Модификаторы</NCheckbox>
              <NCheckbox v-model:checked="form.features.modules.addons" :disabled="isInherited('modules.addons')">Добавки</NCheckbox>
              <NCheckbox v-model:checked="form.features.modules.promotions" :disabled="isInherited('modules.promotions')">Акции</NCheckbox>
              <NCheckbox v-model:checked="form.features.modules.combos" :disabled="isInherited('modules.combos')">Комбо</NCheckbox>
              <NCheckbox v-model:checked="form.features.modules.kitchen" :disabled="isInherited('modules.kitchen')">Кухонный экран (KDS)</NCheckbox>
              <NCheckbox v-model:checked="form.features.modules.dineIn" :disabled="isInherited('modules.dineIn')">QR-столы, зал и бронирования</NCheckbox>
              <NCheckbox v-model:checked="form.features.modules.customers" :disabled="isInherited('modules.customers')">CRM клиентов</NCheckbox>
              <NCheckbox v-model:checked="form.features.modules.branches" :disabled="isInherited('modules.branches')">Несколько филиалов</NCheckbox>
              <NCheckbox v-model:checked="form.features.modules.customRoles" :disabled="isInherited('modules.customRoles')">Кастомные роли</NCheckbox>
              <NCheckbox v-model:checked="form.features.modules.team" :disabled="isInherited('modules.team')">Управление командой</NCheckbox>
            </template>
            <template v-else>
              <NCheckbox v-model:checked="form.features.modules.services" :disabled="isInherited('modules.services')">Онлайн-запись</NCheckbox>
              <NCheckbox v-model:checked="form.features.modules.customers" :disabled="isInherited('modules.customers')">CRM клиентов</NCheckbox>
              <NCheckbox v-model:checked="form.features.modules.branches" :disabled="isInherited('modules.branches')">Несколько филиалов</NCheckbox>
              <NCheckbox v-model:checked="form.features.modules.customRoles" :disabled="isInherited('modules.customRoles')">Кастомные роли</NCheckbox>
              <NCheckbox v-model:checked="form.features.modules.team" :disabled="isInherited('modules.team')">Управление командой</NCheckbox>
            </template>
          </div>

          <!-- Site -->
          <div class="features-group-title">Сайт</div>
          <div class="features-cols">
            <NCheckbox v-model:checked="form.features.site.telegramNotifications" :disabled="isInherited('site.telegramNotifications')">
              Telegram-уведомления
            </NCheckbox>
          </div>

          <!-- Menu (retail only) -->
          <template v-if="form.business_type === 'retail'">
            <div class="features-group-title">Меню</div>
            <div class="features-cols">
              <NCheckbox v-model:checked="form.features.menu.virtualCategories" :disabled="isInherited('menu.virtualCategories')">
                Виртуальные категории
              </NCheckbox>
              <NCheckbox v-model:checked="form.features.menu.ingredients" :disabled="isInherited('menu.ingredients')">
                Ингредиенты в блюде
              </NCheckbox>
            </div>
          </template>

          <!-- Resources (services only) -->
          <template v-if="form.business_type === 'services'">
            <div class="features-group-title">Ресурсы</div>
            <div class="features-row">
              <span>Максимум ресурсов</span>
              <NInputNumber v-model:value="form.features.resources.max" :min="0" style="width: 80px" />
              <span class="hint">0 = ∞</span>
            </div>
          </template>
        </div>

        <div class="actions">
          <NButton @click="modalOpen = false">Отмена</NButton>
          <NButton type="primary" :loading="submitting" attr-type="submit">
            {{ editing ? 'Сохранить' : 'Создать' }}
          </NButton>
        </div>
      </NForm>
    </NModal>
  </div>
</template>

<script setup lang="ts">
import { useFetch } from '#imports'
import { $fetch } from 'ofetch'
import { h, ref, reactive, computed } from 'vue'
import {
  NDataTable, NButton, NModal, NForm, NFormItem, NInput, NInputNumber,
  NSwitch, NTag, NCheckbox, NSelect,
  type DataTableColumns, type FormInst, type FormRules,
} from 'naive-ui'

type PlanModules = {
  delivery: boolean
  pickup: boolean
  modifiers: boolean
  addons: boolean
  promotions: boolean
  combos: boolean
  kitchen: boolean
  dineIn: boolean
  services: boolean
  branches: boolean
  customRoles: boolean
  customers: boolean
  team: boolean
}

type PlanFeatures = {
  modules: PlanModules
  menu: { virtualCategories: boolean; ingredients: boolean }
  resources: { max: number }
  site: { telegramNotifications: boolean }
}

type PlanRow = {
  id: string
  key: string
  business_type: string
  name: string
  description: string
  price: number
  sort_order: number
  is_active: boolean
  badge: string | null
  is_featured: boolean
  features: Partial<{
    modules: Partial<PlanModules>
    menu: { virtualCategories?: boolean; ingredients?: boolean }
    resources: { max?: number }
    site: { telegramNotifications?: boolean }
  }>
  created_at: string
}

const { data, pending, refresh } = await useFetch<PlanRow[]>('/api/plans')

// Billing config
type BillingConfig = { grace_period_days: number; trial_days: number }
const { data: configData } = await useFetch<BillingConfig>('/api/billing-config')
const gracePeriod = ref(configData.value?.grace_period_days ?? 3)
const originalGracePeriod = ref(gracePeriod.value)
const trialDays = ref(configData.value?.trial_days ?? 14)
const originalTrialDays = ref(trialDays.value)
const savingConfig = ref(false)

const saveConfig = async () => {
  savingConfig.value = true
  try {
    await $fetch('/api/billing-config', {
      method: 'PUT',
      body: { grace_period_days: gracePeriod.value, trial_days: trialDays.value },
    })
    originalGracePeriod.value = gracePeriod.value
    originalTrialDays.value = trialDays.value
  } catch (err: unknown) {
    const message = (err as { data?: { message?: string } })?.data?.message ?? 'Ошибка'

    window.alert(message)
  } finally {
    savingConfig.value = false
  }
}

const allPlans = computed(() => data.value ?? [])

const planGroups = computed(() => [
  { type: 'retail', label: 'Магазины и рестораны (retail)', plans: allPlans.value.filter((p) => p.business_type === 'retail') },
  { type: 'services', label: 'Услуги и запись (services)', plans: allPlans.value.filter((p) => p.business_type === 'services') },
])

import { getPlanTierOrder, formatPrice } from '@fastio/shared'

const editing = ref<PlanRow | null>(null)
const modalOpen = ref(false)
const submitting = ref(false)
const formRef = ref<FormInst | null>(null)

const emptyModules = (): PlanModules => ({
  delivery: false, pickup: false, modifiers: false, addons: false,
  promotions: false, combos: false, kitchen: false, dineIn: false,
  services: false, branches: false,
  customRoles: false, customers: false, team: false,
})

const defaultForm = () => ({
  key: '',
  business_type: 'retail',
  name: '',
  description: '',
  price: 0,
  sort_order: 0,
  is_active: true,
  badge: '' as string,
  is_featured: false,
  features: {
    modules: emptyModules(),
    menu: { virtualCategories: false, ingredients: false },
    resources: { max: 0 },
    site: { telegramNotifications: false },
  } as PlanFeatures,
})
const form = reactive(defaultForm())

// Accumulated inherited features from all lower-tier plans of the same business type
const inheritedFeatures = computed(() => {
  if (!editing.value) return null

  const currentOrder = getPlanTierOrder(editing.value.key)
  const businessType = editing.value.business_type

  const lowerPlans = allPlans.value.filter(
    (p) => p.business_type === businessType && getPlanTierOrder(p.key) < currentOrder,
  )

  const acc = {
    modules: {} as Record<string, boolean>,
    menu: { virtualCategories: false, ingredients: false },
    resources: { max: -1 },
    site: { telegramNotifications: false },
  }

  for (const p of lowerPlans) {
    const f = p.features

    if (f.modules) {
      for (const [k, v] of Object.entries(f.modules)) {
        if (v === true) acc.modules[k] = true
      }
    }
    if (f.menu?.virtualCategories) acc.menu.virtualCategories = true
    if (f.menu?.ingredients) acc.menu.ingredients = true
    if (f.resources?.max !== undefined) acc.resources.max = f.resources.max
    if (f.site?.telegramNotifications) acc.site.telegramNotifications = true
  }

  return acc
})

const isInherited = (path: string) => {
  if (!inheritedFeatures.value) return false
  const parts = path.split('.')

  if (parts[0] === 'modules' && parts[1]) {
    return inheritedFeatures.value.modules[parts[1]] === true
  }
  if (parts[0] === 'menu' && parts[1] === 'virtualCategories') return inheritedFeatures.value.menu.virtualCategories
  if (parts[0] === 'menu' && parts[1] === 'ingredients') return inheritedFeatures.value.menu.ingredients
  if (parts[0] === 'site' && parts[1] === 'telegramNotifications') return inheritedFeatures.value.site.telegramNotifications

  return false
}

const MODULE_LABELS: Record<string, string> = {
  delivery: 'Доставка', pickup: 'Самовывоз', modifiers: 'Модификаторы', addons: 'Добавки',
  promotions: 'Акции', combos: 'Комбо', kitchen: 'KDS', dineIn: 'QR-столы и брони',
  services: 'Онлайн-запись', branches: 'Филиалы',
  customRoles: 'Кастомные роли', customers: 'CRM', team: 'Команда',
}

const inheritedLabels = computed(() => {
  if (!inheritedFeatures.value) return []
  const labels: string[] = []

  for (const [k, v] of Object.entries(inheritedFeatures.value.modules)) {
    if (v) labels.push(MODULE_LABELS[k] ?? k)
  }
  if (inheritedFeatures.value.menu.virtualCategories) labels.push('Виртуал. категории')
  if (inheritedFeatures.value.menu.ingredients) labels.push('Ингредиенты')
  if (inheritedFeatures.value.site.telegramNotifications) labels.push('Telegram')

  return labels
})

const rules: FormRules = {
  key: [{ required: true, message: 'Введи ключ', trigger: 'blur' }],
  name: [{ required: true, message: 'Введи название', trigger: 'blur' }],
  business_type: [{ required: true, message: 'Выбери тип', trigger: 'change' }],
}

const openCreate = () => {
  editing.value = null
  Object.assign(form, defaultForm())
  modalOpen.value = true
}

const openEdit = (row: PlanRow) => {
  editing.value = row
  const f = row.features ?? {}

  Object.assign(form, {
    key: row.key,
    business_type: row.business_type,
    name: row.name,
    description: row.description,
    price: row.price,
    sort_order: row.sort_order,
    is_active: row.is_active,
    badge: row.badge ?? '',
    is_featured: row.is_featured ?? false,
    features: {
      modules: { ...emptyModules(), ...(f.modules ?? {}) },
      menu: { virtualCategories: f.menu?.virtualCategories ?? false, ingredients: f.menu?.ingredients ?? false },
      resources: { max: f.resources?.max ?? 0 },
      site: { telegramNotifications: f.site?.telegramNotifications ?? false },
    },
  })
  modalOpen.value = true
}

const columns: DataTableColumns<PlanRow> = [
  { title: 'Ключ', key: 'key', width: 180 },
  { title: 'Название', key: 'name' },
  {
    title: 'Цена',
    key: 'price',
    width: 120,
    render: (row) => row.price > 0 ? formatPrice(row.price) : 'Бесплатно',
    sorter: (a, b) => a.price - b.price,
  },
  { title: 'Порядок', key: 'sort_order', width: 90, sorter: (a, b) => a.sort_order - b.sort_order },
  {
    title: 'Статус',
    key: 'is_active',
    width: 100,
    render: (row) => h(NTag, { type: row.is_active ? 'success' : 'default', size: 'small' }, { default: () => row.is_active ? 'Активен' : 'Отключён' }),
  },
  {
    title: '',
    key: 'actions',
    width: 100,
    render: (row) => h(NButton, { size: 'small', onClick: () => openEdit(row) }, { default: () => 'Изменить' }),
  },
]

// Strip inherited features before saving — store only the delta.
// Пустые подобъекты не пишем (modules: {}, menu: {} и т.д.), чтобы фичи в БД были минимальными.
const buildFeaturesPayload = () => {
  const f = form.features
  const inh = inheritedFeatures.value
  const payload: Record<string, unknown> = {}

  const modules: Record<string, boolean> = {}

  for (const [k, v] of Object.entries(f.modules)) {
    if (v && !inh?.modules[k]) modules[k] = true
  }
  if (Object.keys(modules).length > 0) payload.modules = modules

  const menu: Record<string, boolean> = {}

  if (f.menu.virtualCategories && !inh?.menu.virtualCategories) menu.virtualCategories = true
  if (f.menu.ingredients && !inh?.menu.ingredients) menu.ingredients = true
  if (Object.keys(menu).length > 0) payload.menu = menu

  const site: Record<string, boolean> = {}

  if (f.site.telegramNotifications && !inh?.site.telegramNotifications) site.telegramNotifications = true
  if (Object.keys(site).length > 0) payload.site = site

  if (form.business_type === 'services') {
    payload.resources = { max: f.resources.max }
  }

  return payload
}

async function submit() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  submitting.value = true
  try {
    const payload = {
      key: form.key,
      business_type: form.business_type,
      name: form.name,
      description: form.description,
      price: form.price,
      sort_order: form.sort_order,
      is_active: form.is_active,
      badge: form.badge || null,
      is_featured: form.is_featured,
      features: buildFeaturesPayload(),
    }

    if (editing.value) {
      await $fetch(`/api/plans/${editing.value.id}`, { method: 'PUT', body: payload })
    } else {
      await $fetch('/api/plans', { method: 'POST', body: payload })
    }
    modalOpen.value = false
    await refresh()
  } catch (err: unknown) {
    const message = (err as { data?: { message?: string } })?.data?.message ?? 'Неизвестная ошибка'

    window.alert(`Ошибка: ${message}`)
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
.page-root {
  padding: 32px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.subtitle {
  font-size: 16px;
  color: #888;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-bottom: 24px;
}

.group {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
}

.group-title {
  font-size: 13px;
  font-weight: 600;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 12px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 24px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
}

.row-form {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.form-label {
  font-size: 14px;
  color: #555;
  min-width: 280px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 16px;

  .span-2 { grid-column: span 2; }
}

.form-row-inline {
  display: flex;
  align-items: flex-end;
  gap: 12px;
}

.features-section {
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  padding: 12px 16px;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.features-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.features-title {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.features-hint {
  font-size: 12px;
  color: #aaa;
}

.features-group-title {
  font-size: 11px;
  font-weight: 600;
  color: #aaa;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 4px;
}

.features-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 24px;
}

.features-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.hint {
  font-size: 12px;
  color: #aaa;
}

.inherited-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  background: #f9f9f9;
  border-radius: 4px;
}

.inherited-label {
  font-size: 12px;
  color: #aaa;
  white-space: nowrap;
  padding-top: 2px;
}

.inherited-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.inherited-tag {
  color: #bbb !important;
  background: #f0f0f0 !important;
}
</style>
