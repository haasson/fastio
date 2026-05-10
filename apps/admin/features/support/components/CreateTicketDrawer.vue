<template>
  <UiDrawer
    :model-value="show"
    title="Новое обращение"
    :width="480"
    :actions="drawerActions"
    :on-confirm="onSubmit"
    :on-decline="() => $emit('close')"
    @update:model-value="!$event && $emit('close')"
  >
    <div class="create-ticket-root">
      <UiInput
        v-model="form.subject"
        label="Тема"
        placeholder="О чём обращение?"
      />

      <UiInput
        v-model="form.body"
        label="Сообщение"
        type="textarea"
        :rows="6"
        placeholder="Опишите вашу проблему или вопрос"
      />

      <div class="images-section">
        <UiText size="tiny" color="secondary">Изображения (до 3)</UiText>
        <div class="images-row">
          <div
            v-for="(url, i) in previewUrls"
            :key="i"
            class="thumb"
          >
            <img :src="url" alt="" />
            <button class="thumb-remove" @click="removeImage(i)">&times;</button>
          </div>
          <label
            v-if="previewUrls.length < 3"
            class="attach-btn"
          >
            <UiIcon name="plus" :size="20" color="currentColor" />
            <input
              type="file"
              accept="image/*"
              hidden
              :disabled="submitting"
              @change="onFileChange"
            />
          </label>
        </div>
      </div>
    </div>
  </UiDrawer>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { UiDrawer, UiInput, UiText, useMessage } from '@fastio/ui'
import { UiIcon } from '@fastio/icons'
import type { DrawerAction } from '@fastio/ui'
import { useDatabase } from '~/composables/data/useDatabase'
import { useTenantStore } from '~/stores/tenant'
import { reportError } from '~/utils/reportError'

defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
  created: [id: string]
}>()

const api = useDatabase()
const tenantStore = useTenantStore()
const { currentTenantId } = storeToRefs(tenantStore)
const { success, error: showError } = useMessage()

const form = ref({ subject: '', body: '' })
const pendingFiles = ref<File[]>([])
const previewUrls = ref<string[]>([])
const submitting = ref(false)

const canSubmit = computed(() => form.value.subject.trim() && form.value.body.trim() && !submitting.value)

const drawerActions = computed<DrawerAction[]>(() => [
  { text: 'Отмена', type: 'default', actionType: 'decline' },
  { text: 'Отправить', type: 'primary', actionType: 'confirm', disabled: !canSubmit.value, loading: submitting.value },
])

const onFileChange = (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) return

  pendingFiles.value.push(file)
  previewUrls.value.push(URL.createObjectURL(file))
  input.value = ''
}

const removeImage = (index: number) => {
  URL.revokeObjectURL(previewUrls.value[index])
  pendingFiles.value.splice(index, 1)
  previewUrls.value.splice(index, 1)
}

const onSubmit = async () => {
  if (!canSubmit.value || !currentTenantId.value) return false

  submitting.value = true

  try {
    const ticket = await api.support.createTicket(currentTenantId.value, form.value.subject.trim())

    const uploadedUrls = await Promise.all(
      pendingFiles.value.map((f) => api.support.uploadImage(currentTenantId.value!, ticket.id, f)),
    )

    await api.support.sendMessage(
      ticket.id,
      form.value.body.trim(),
      uploadedUrls.length ? uploadedUrls : undefined,
    )

    success('Обращение создано')
    form.value = { subject: '', body: '' }
    pendingFiles.value = []
    previewUrls.value = []
    emit('created', ticket.id)
  } catch (err) {
    reportError(err)
    showError('Не удалось создать обращение')

    return false
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
.create-ticket-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.images-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.images-row {
  display: flex;
  gap: var(--space-8);
  flex-wrap: wrap;
}

.thumb {
  position: relative;
  width: 72px;
  height: 72px;
  border-radius: var(--radius-8);
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.thumb-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: var(--radius-full);
  background: rgba(0, 0, 0, 0.5);
  color: var(--color-white);
  font-size: var(--font-size-md);
  /* stylelint-disable-next-line scale-unlimited/declaration-strict-value */
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.attach-btn {
  width: 72px;
  height: 72px;
  border-radius: var(--radius-8);
  border: 1px dashed var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: border-color 0.15s, color 0.15s;

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  &.uploading {
    opacity: 0.5;
    pointer-events: none;
  }
}
</style>
