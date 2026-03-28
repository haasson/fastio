<template>
  <div class="page-root">
    <header class="header">
      <span class="subtitle">Тенанты платформы</span>
      <NButton type="primary" @click="modalOpen = true">
        Создать тенант
      </NButton>
    </header>

    <main class="content">
      <NDataTable
        :columns="columns"
        :data="tenants"
        :loading="pending"
        :pagination="{ pageSize: 20 }"
        :bordered="false"
        :row-props="rowProps"
        :scroll-x="900"
        striped
      />

      <div v-if="error" class="error">
        Ошибка загрузки: {{ error.message }}
      </div>
    </main>

    <NModal
      v-model:show="modalOpen"
      preset="card"
      title="Создать тенант"
      style="width: 480px"
    >
      <NForm
        ref="formRef"
        :model="form"
        :rules="rules"
        label-placement="top"
        @submit.prevent="submit"
      >
        <NFormItem label="Название" path="name">
          <NInput v-model:value="form.name" placeholder="Пицца Васи" />
        </NFormItem>

        <NFormItem label="Слаг" path="slug">
          <NInput v-model:value="form.slug" placeholder="vasya-pizza" />
        </NFormItem>

        <NFormItem label="Email владельца" path="email">
          <NInput v-model:value="form.email" placeholder="owner@example.com" />
        </NFormItem>

        <div class="actions">
          <NButton @click="modalOpen = false">Отмена</NButton>
          <NButton type="primary" :loading="submitting" attr-type="submit">
            Создать
          </NButton>
        </div>
      </NForm>
    </NModal>
  </div>
</template>

<script setup lang="ts">
import { useFetch, useRouter } from '#imports'
import { $fetch } from 'ofetch'
import { h, ref, reactive, computed } from 'vue'
import {
  NDataTable, NTag, NButton, NModal, NForm, NFormItem, NInput, NSpace,
  type DataTableColumns, type FormInst, type FormRules,
} from 'naive-ui'

const router = useRouter()

type TenantRow = {
  id: string
  name: string
  slug: string
  ownerEmail: string
  plan: string
  balance: number
  branchCount: number
  createdAt: string
  isActivated: boolean
}

const { data, pending, error, refresh } = await useFetch<TenantRow[]>('/api/tenants')
const tenants = computed(() => data.value ?? [])

const rowProps = (row: TenantRow) => ({
  style: 'cursor: pointer',
  onClick: () => router.push(`/tenants/${row.id}`),
})

const resendingId = ref<string | null>(null)

async function resendInvite(row: TenantRow, e: MouseEvent) {
  e.stopPropagation()
  resendingId.value = row.id
  try {
    await $fetch(`/api/tenants/${row.id}/resend-invite`, { method: 'POST' })
    window.alert(`Приглашение отправлено на ${row.ownerEmail}`)
  } catch (err: unknown) {
    const message = (err as { data?: { message?: string } })?.data?.message ?? 'Ошибка'

    window.alert(`Ошибка: ${message}`)
  } finally {
    resendingId.value = null
  }
}

const columns: DataTableColumns<TenantRow> = [
  {
    title: 'Название',
    key: 'name',
    sorter: (a, b) => a.name.localeCompare(b.name),
  },
  {
    title: 'Слаг',
    key: 'slug',
    render: (row) => h(NTag, { size: 'small', bordered: false }, { default: () => row.slug }),
  },
  {
    title: 'Email владельца',
    key: 'ownerEmail',
  },
  {
    title: 'Статус',
    key: 'isActivated',
    width: 180,
    render: (row) => {
      if (row.isActivated) {
        return h(NTag, { type: 'success', size: 'small', bordered: false }, { default: () => 'Активен' })
      }

      return h(NSpace, { align: 'center', size: 'small' }, {
        default: () => [
          h(NTag, { type: 'warning', size: 'small', bordered: false }, { default: () => 'Приглашён' }),
          h(NButton, {
            size: 'tiny',
            loading: resendingId.value === row.id,
            onClick: (e: MouseEvent) => resendInvite(row, e),
          }, { default: () => 'Отправить снова' }),
        ],
      })
    },
  },
  {
    title: 'Тариф',
    key: 'plan',
    width: 120,
  },
  {
    title: 'Баланс',
    key: 'balance',
    width: 120,
    render: (row) => `${row.balance} ₽`,
    sorter: (a, b) => a.balance - b.balance,
  },
  {
    title: 'Филиалы',
    key: 'branchCount',
    width: 100,
    sorter: (a, b) => a.branchCount - b.branchCount,
  },
  {
    title: 'Дата регистрации',
    key: 'createdAt',
    width: 160,
    sorter: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    render: (row) => new Date(row.createdAt).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
  },
]

// ─── Форма создания ────────────────────────────────────────────────────────────

const modalOpen = ref(false)
const submitting = ref(false)
const formRef = ref<FormInst | null>(null)

const form = reactive({ name: '', slug: '', email: '' })

const rules: FormRules = {
  name: [{ required: true, message: 'Введи название', trigger: 'blur' }],
  slug: [
    { required: true, message: 'Введи слаг', trigger: 'blur' },
    { pattern: /^[a-z0-9-]+$/, message: 'Только строчные латиница, цифры, дефис', trigger: 'blur' },
  ],
  email: [
    { required: true, message: 'Введи email', trigger: 'blur' },
    { type: 'email', message: 'Некорректный email', trigger: 'blur' },
  ],
}

async function submit() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  submitting.value = true
  try {
    await $fetch('/api/tenants', {
      method: 'POST',
      body: { name: form.name, slug: form.slug, email: form.email },
    })
    modalOpen.value = false
    form.name = ''
    form.slug = ''
    form.email = ''
    await refresh()
  } catch (err: unknown) {
    const message = (err as { data?: { message?: string } })?.data?.message ?? 'Неизвестная ошибка'

    window.alert(`Ошибка: ${message}`)
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
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

.error {
  margin-top: 16px;
  color: #e03;
  font-size: 14px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
</style>
