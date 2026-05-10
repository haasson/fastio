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
import { ref, toRefs, watch } from 'vue'
import { UiInput, UiButton } from '@fastio/ui'
import { formatRelativeTime } from '@fastio/shared'
import { useOrderNotes } from '../composables/useOrderNotes'

const props = defineProps<{
  orderId: string
  tenantId: string
  refreshKey: number
}>()

const { orderId, tenantId } = toRefs(props)
const { notes, loading: notesLoading, fetch: fetchNotes, add: addNote } = useOrderNotes(orderId, tenantId)

const addingNote = ref(false)
const newNote = ref('')
const now = new Date()

const NOTE_ROLE_COLORS: Record<string, string> = {
  owner: 'var(--red-500)',
  admin: 'var(--blue-500)',
  manager: 'var(--orange-500)',
  staff: 'var(--grey-400)',
}

const noteRoleColor = (role: string) => NOTE_ROLE_COLORS[role] ?? 'var(--grey-400)'

const submitNote = async () => {
  if (!newNote.value.trim()) return
  addingNote.value = true
  await addNote(newNote.value.trim())
  newNote.value = ''
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
  gap: var(--space-8);
}

.section-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-secondary);
}

.notes-thread {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  min-height: 32px;
}

.notes-empty {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
}

.note {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-8) var(--space-12);
  border-radius: var(--radius-8);
  background: var(--color-bg-subtle);
  border-left: 3px solid var(--grey-400);
}

.note-meta {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.note-author {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-title);
}

.note-time {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.note-text {
  font-size: var(--font-size-base);
  color: var(--color-text);
  white-space: pre-wrap;
}

.add-note {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  align-items: stretch;

  :deep(.n-button) {
    align-self: flex-end;
  }
}
</style>
