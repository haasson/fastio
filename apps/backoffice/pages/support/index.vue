<template>
  <div class="page-root">
    <header class="header">
      <span class="subtitle">Обращения в поддержку</span>
      <NSelect
        v-model:value="statusFilter"
        :options="statusOptions"
        style="width: 220px"
      />
    </header>

    <main class="content">
      <NDataTable
        :columns="columns"
        :data="tickets"
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
  </div>
</template>

<script setup lang="ts">
import { useFetch, useRouter } from '#imports'
import { computed, h, onMounted, onUnmounted, ref } from 'vue'
import {
  NDataTable, NTag, NSelect, NBadge,
  type DataTableColumns,
} from 'naive-ui'

const router = useRouter()

type TicketRow = {
  id: string
  tenantId: string
  tenantName: string
  subject: string
  status: string
  createdAt: string
  updatedAt: string
  unreadCount: number
  lastMessage: string | null
  lastMessageAt: string | null
}

const statusFilter = ref<string>('all')

const statusOptions = [
  { label: 'Все', value: 'all' },
  { label: 'Открытые', value: 'open' },
  { label: 'Ожидают ответа', value: 'waiting_for_reply' },
  { label: 'Закрытые', value: 'resolved' },
]

const statusMap: Record<string, { label: string; type: 'default' | 'info' | 'success' | 'warning' | 'error' }> = {
  open: { label: 'Открыт', type: 'warning' },
  waiting_for_reply: { label: 'Ожидает ответа', type: 'info' },
  resolved: { label: 'Закрыт', type: 'success' },
}

const { data, pending, error, refresh } = await useFetch<TicketRow[]>('/api/support/list', {
  query: computed(() => {
    const q: Record<string, string> = {}

    if (statusFilter.value !== 'all') q.status = statusFilter.value

    return q
  }),
})

const tickets = computed(() => data.value ?? [])

const rowProps = (row: TicketRow) => ({
  style: 'cursor: pointer',
  onClick: () => router.push(`/support/${row.id}`),
})

const columns: DataTableColumns<TicketRow> = [
  {
    title: 'Тенант',
    key: 'tenantName',
    width: 180,
    sorter: (a, b) => a.tenantName.localeCompare(b.tenantName),
  },
  {
    title: 'Тема',
    key: 'subject',
    render: (row) => {
      if (row.unreadCount > 0) {
        return h(NBadge, { value: row.unreadCount, type: 'error', offset: [12, 0] }, {
          default: () => row.subject,
        })
      }

      return row.subject
    },
  },
  {
    title: 'Статус',
    key: 'status',
    width: 160,
    render: (row) => {
      const s = statusMap[row.status] ?? { label: row.status, type: 'default' as const }

      return h(NTag, { type: s.type, size: 'small', bordered: false }, { default: () => s.label })
    },
  },
  {
    title: 'Последнее сообщение',
    key: 'lastMessage',
    ellipsis: { tooltip: true },
    render: (row) => row.lastMessage ?? '—',
  },
  {
    title: 'Обновлено',
    key: 'updatedAt',
    width: 160,
    sorter: (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
    render: (row) => new Date(row.updatedAt).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
  },
]

let pollInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  pollInterval = setInterval(() => refresh(), 15000)
})

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
})
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

.error {
  margin-top: 16px;
  color: #e03;
  font-size: 14px;
}
</style>
