<template>
  <div class="page-root">
    <header class="header">
      <div class="header-left">
        <h1 class="title">Fastio Backoffice</h1>
        <span class="subtitle">Тенанты платформы</span>
      </div>
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
import { useFetch } from '#imports'
import { $fetch } from 'ofetch'
import { h, ref, reactive, computed } from 'vue'
import {
  NDataTable, NTag, NButton, NModal, NForm, NFormItem, NInput,
  type DataTableColumns, type FormInst, type FormRules,
} from 'naive-ui'

type TenantRow = {
  id: string
  name: string
  slug: string
  ownerEmail: string
  branchCount: number
  createdAt: string
}

const { data, pending, error, refresh } = await useFetch<TenantRow[]>('/api/tenants')
const tenants = computed(() => data.value ?? [])

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
    title: 'Филиалы',
    key: 'branchCount',
    width: 120,
    sorter: (a, b) => a.branchCount - b.branchCount,
  },
  {
    title: 'Дата регистрации',
    key: 'createdAt',
    width: 180,
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
  min-height: 100vh;
  padding: 32px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 16px;
}

.title {
  font-size: 24px;
  font-weight: 700;
  color: #111;
}

.subtitle {
  font-size: 14px;
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
