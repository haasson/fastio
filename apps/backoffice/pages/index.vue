<template>
  <div class="page-root">
    <header class="header">
      <h1 class="title">Fastio Backoffice</h1>
      <span class="subtitle">Тенанты платформы</span>
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
  </div>
</template>

<script setup lang="ts">
import { h } from 'vue'
import { NDataTable, NTag, type DataTableColumns } from 'naive-ui'

type TenantRow = {
  id: string
  name: string
  slug: string
  ownerEmail: string
  branchCount: number
  createdAt: string
}

const { data, pending, error } = await useFetch<TenantRow[]>('/api/tenants')

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
    render: row => h(NTag, { size: 'small', bordered: false }, { default: () => row.slug }),
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
    render: row => new Date(row.createdAt).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
  },
]
</script>

<style scoped>
.page-root {
  min-height: 100vh;
  padding: 32px;
}

.header {
  display: flex;
  align-items: baseline;
  gap: 16px;
  margin-bottom: 24px;
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
</style>
