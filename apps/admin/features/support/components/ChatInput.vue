<template>
  <div class="chat-input-root">
    <div v-if="imageUrls.length" class="previews">
      <div
        v-for="(url, i) in imageUrls"
        :key="i"
        class="mini-thumb"
      >
        <img :src="url" alt="" />
        <button class="mini-remove" @click="removeImage(i)">&times;</button>
      </div>
    </div>
    <div class="input-row">
      <label class="attach">
        <UiIcon name="image" :size="20" color="currentColor" />
        <input
          type="file"
          accept="image/*"
          hidden
          :disabled="uploading"
          @change="onFileChange"
        />
      </label>
      <textarea
        ref="textareaRef"
        v-model="body"
        class="textarea"
        placeholder="Написать сообщение..."
        rows="1"
        @input="autoResize"
        @keydown="onKeydown"
      />
      <button
        class="send-btn"
        :disabled="!canSend"
        @click="send"
      >
        <UiIcon name="send" :size="20" color="currentColor" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { UiIcon } from '@fastio/icons'

const emit = defineEmits<{
  send: [body: string, imageUrls: string[]]
  upload: [file: File, callback: (url: string | null) => void]
}>()

const body = ref('')
const imageUrls = ref<string[]>([])
const uploading = ref(false)
const textareaRef = ref<HTMLElement | null>(null)

const canSend = computed(() => (body.value.trim() || imageUrls.value.length) && !uploading.value)

const autoResize = () => {
  const el = textareaRef.value

  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 150)}px`
}

const send = () => {
  if (!canSend.value) return

  emit('send', body.value.trim(), [...imageUrls.value])
  body.value = ''
  imageUrls.value = []

  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto'
    }
  })
}

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}

const onFileChange = (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) return

  uploading.value = true
  emit('upload', file, (url: string | null) => {
    if (url) imageUrls.value.push(url)
    uploading.value = false
  })
  input.value = ''
}

const removeImage = (index: number) => {
  imageUrls.value.splice(index, 1)
}
</script>

<style scoped lang="scss">
.chat-input-root {
  border-top: 1px solid var(--color-border);
  padding: var(--space-12) var(--space-16);
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  background: var(--color-bg-card);
}

.previews {
  display: flex;
  gap: var(--space-8);
}

.mini-thumb {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-8);
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.mini-remove {
  position: absolute;
  top: 1px;
  right: 1px;
  width: 16px;
  height: 16px;
  border: none;
  border-radius: var(--radius-full);
  background: rgba(0, 0, 0, 0.5);
  color: var(--color-white);
  font-size: var(--font-size-xs);
  /* stylelint-disable-next-line scale-unlimited/declaration-strict-value */
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.input-row {
  display: flex;
  align-items: flex-end;
  gap: var(--space-8);
}

.attach {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-8);
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: color 0.15s;

  &:hover {
    color: var(--color-primary);
  }
}

.textarea {
  flex: 1;
  resize: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
  padding: var(--space-8) var(--space-12);
  font-size: var(--font-size-md);
  line-height: var(--line-height-loose);
  font-family: inherit;
  background: var(--color-bg-card);
  color: var(--color-text);
  outline: none;
  max-height: 150px;
  transition: border-color 0.15s;

  &:focus {
    border-color: var(--color-primary);
  }

  &::placeholder {
    color: var(--color-text-secondary);
  }
}

.send-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: var(--radius-8);
  background: var(--color-primary);
  color: var(--color-white);
  cursor: pointer;
  transition: opacity 0.15s;

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &:not(:disabled):hover {
    opacity: 0.85;
  }
}
</style>
