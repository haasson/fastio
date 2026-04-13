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
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--color-bg-card);
}

.previews {
  display: flex;
  gap: 6px;
}

.mini-thumb {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 6px;
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
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.input-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.attach {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
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
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 14px;
  line-height: 1.5;
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
  border-radius: 8px;
  background: var(--color-primary);
  color: #fff;
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
