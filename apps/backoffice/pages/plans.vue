<template>
  <div class="page-root">
    <header class="header">
      <span class="subtitle">Тарифные планы</span>
      <NButton type="primary" @click="openCreate">Создать тариф</NButton>
    </header>

    <main class="content">
      <NDataTable
        :columns="columns"
        :data="plans"
        :loading="pending"
        :bordered="false"
        striped
      />
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
      style="width: 480px"
    >
      <NForm
        ref="formRef"
        :model="form"
        :rules="rules"
        label-placement="top"
        @submit.prevent="submit"
      >
        <NFormItem label="Ключ (key)" path="key">
          <NInput v-model:value="form.key" :disabled="!!editing" placeholder="business" />
        </NFormItem>
        <NFormItem label="Название" path="name">
          <NInput v-model:value="form.name" placeholder="Бизнес" />
        </NFormItem>
        <NFormItem label="Описание" path="description">
          <NInput v-model:value="form.description" type="textarea" :rows="2" />
        </NFormItem>
        <NFormItem label="Цена (₽/мес)" path="price">
          <NInputNumber v-model:value="form.price" :min="0" style="width: 100%" />
        </NFormItem>
        <NFormItem label="Порядок сортировки" path="sort_order">
          <NInputNumber v-model:value="form.sort_order" :min="0" style="width: 100%" />
        </NFormItem>
        <NFormItem label="Активен">
          <NSwitch v-model:value="form.is_active" />
        </NFormItem>
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
  NDataTable, NButton, NModal, NForm, NFormItem, NInput, NInputNumber, NSwitch, NTag,
  type DataTableColumns, type FormInst, type FormRules,
} from 'naive-ui'

type PlanRow = {
  id: string
  key: string
  name: string
  description: string
  price: number
  sort_order: number
  is_active: boolean
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
const plans = computed(() => data.value ?? [])

const editing = ref<PlanRow | null>(null)
const modalOpen = ref(false)
const submitting = ref(false)
const formRef = ref<FormInst | null>(null)

const defaultForm = () => ({ key: '', name: '', description: '', price: 0, sort_order: 0, is_active: true })
const form = reactive(defaultForm())

const rules: FormRules = {
  key: [{ required: true, message: 'Введи ключ', trigger: 'blur' }],
  name: [{ required: true, message: 'Введи название', trigger: 'blur' }],
}

const openCreate = () => {
  editing.value = null
  Object.assign(form, defaultForm())
  modalOpen.value = true
}

const openEdit = (row: PlanRow) => {
  editing.value = row
  Object.assign(form, {
    key: row.key,
    name: row.name,
    description: row.description,
    price: row.price,
    sort_order: row.sort_order,
    is_active: row.is_active,
  })
  modalOpen.value = true
}

const columns: DataTableColumns<PlanRow> = [
  { title: 'Ключ', key: 'key', width: 120 },
  { title: 'Название', key: 'name' },
  {
    title: 'Цена',
    key: 'price',
    width: 120,
    render: (row) => row.price > 0 ? `${row.price} ₽` : 'Бесплатно',
    sorter: (a, b) => a.price - b.price,
  },
  { title: 'Порядок', key: 'sort_order', width: 100, sorter: (a, b) => a.sort_order - b.sort_order },
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

async function submit() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  submitting.value = true
  try {
    if (editing.value) {
      await $fetch(`/api/plans/${editing.value.id}`, { method: 'PUT', body: form })
    } else {
      await $fetch('/api/plans', { method: 'POST', body: form })
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
  background: #fff;
  border-radius: 8px;
  padding: 16px;
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
}

.form-label {
  font-size: 14px;
  color: #555;
}
</style>
