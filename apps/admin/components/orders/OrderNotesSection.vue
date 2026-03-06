<template>
  <section class="section">
    <div class="section-label">Заметки</div>

    <div class="notes-thread">
      <div v-if="notesLoading" class="notes-empty">Загрузка…</div>
      <div v-else-if="notes.length === 0" class="notes-empty">Заметок пока нет</div>
      <div
        v-for="note in notes"
        :key="note.id"
        class="note"
        :style="{ borderLeftColor: noteRoleColor(note.authorRole) }"
      >
        <div class="note-meta">
          <span class="note-author">{{ note.authorName }}</span>
          <span class="note-time">{{ formatRelativeTime(note.createdAt, now) }}</span>
        </div>
        <div class="note-text">{{ note.content }}</div>
      </div>
    </div>

    <div class="add-note">
      <UiInput
        v-model="newNote"
        type="textarea"
        :rows="2"
        placeholder="Написать заметку…"
      />
      <UiButton
        type="primary"
        size="small"
        :disabled="!newNote.trim() || addingNote"
        :loading="addingNote"
        @click="submitNote"
      >
        Добавить
      </UiButton>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { UiInput, UiButton } from '@fastio/ui'
import type { OrderNote } from '@fastio/shared'
import { useSupabaseApi } from '#imports'
import { useAuthStore } from '~/stores/auth'
import { useTenantStore } from '~/stores/tenant'
import { formatRelativeTime } from '~/utils/formatRelativeTime'

const props = defineProps<{
  orderId: string
  tenantId: string
  refreshKey: number
}>()

const api = useSupabaseApi()
const authStore = useAuthStore()
const tenantStore = useTenantStore()

const notesLoading = ref(false)
const addingNote = ref(false)
const notes = ref<OrderNote[]>([])
const newNote = ref('')
const now = new Date()

const NOTE_ROLE_COLORS: Record<string, string> = {
  owner: 'var(--red-500)',
  admin: 'var(--blue-500)',
  manager: 'var(--orange-500)',
  staff: 'var(--grey-400)',
}

const noteRoleColor = (role: string) => NOTE_ROLE_COLORS[role] ?? 'var(--grey-400)'

const fetchNotes = async () => {
  notesLoading.value = true
  notes.value = await api.orderNotes.list(props.orderId)
  notesLoading.value = false
}

const submitNote = async () => {
  if (!authStore.user || !newNote.value.trim()) return
  addingNote.value = true
  const note = await api.orderNotes.add({
    orderId: props.orderId,
    tenantId: props.tenantId,
    authorId: authStore.user.id,
    authorName: authStore.user.email ?? 'Оператор',
    authorRole: tenantStore.currentRole ?? 'staff',
    content: newNote.value.trim(),
  })

  if (note) {
    notes.value.push(note)
    newNote.value = ''
  }
  addingNote.value = false
}

watch(
  () => props.refreshKey,
  () => {
    notes.value = []
    newNote.value = ''
    fetchNotes()
  },
  { immediate: true },
)
</script>

<style scoped lang="scss">
.section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-secondary);
}

.notes-thread {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 32px;
}

.notes-empty {
  font-size: 13px;
  color: var(--color-text-tertiary);
}

.note {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--color-bg-subtle);
  border-left: 3px solid var(--grey-400);
}

.note-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.note-author {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-title);
}

.note-time {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.note-text {
  font-size: 13px;
  color: var(--color-text);
  white-space: pre-wrap;
}

.add-note {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: stretch;

  :deep(.n-button) {
    align-self: flex-end;
  }
}
</style>
