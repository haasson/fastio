<template>
  <div class="ai-chat-root">
    <!-- Floating button -->
    <button class="fab" :class="{ active: isOpen }" @click="isOpen = !isOpen">
      <UiIcon :name="isOpen ? 'close' : 'sparkles'" :size="22" color="currentColor" />
    </button>

    <!-- Chat panel -->
    <Transition name="chat-panel">
      <div v-if="isOpen" class="panel">
        <div class="panel-header">
          <UiIcon name="sparkles" :size="18" color="currentColor" />
          <span class="panel-title">AI Ассистент</span>
          <button class="clear-btn" title="Очистить чат" @click="clearChat">
            <UiIcon name="trash" :size="16" color="currentColor" />
          </button>
        </div>

        <div ref="messagesRef" class="messages">
          <div v-if="messages.length === 0" class="empty">
            <UiIcon name="sparkles" :size="32" color="var(--color-primary)" />
            <UiText size="small" class="empty-text">
              Привет! Я AI-ассистент Fastio. Спроси меня о любом разделе админки — помогу разобраться.
            </UiText>
          </div>

          <div
            v-for="message in messages"
            :key="message.id"
            class="message"
            :class="message.role"
          >
            <div class="bubble">{{ message.content }}</div>
          </div>

          <div v-if="isLoading" class="message assistant">
            <div class="bubble typing">
              <span class="dot" />
              <span class="dot" />
              <span class="dot" />
            </div>
          </div>

          <div v-if="error" class="message-error">
            <UiText size="tiny" class="error-text">Ошибка. Попробуйте ещё раз.</UiText>
            <button class="retry-btn" @click="reload">Повторить</button>
          </div>
        </div>

        <form class="input-area" @submit.prevent="onSubmit">
          <input
            v-model="input"
            class="chat-input"
            placeholder="Задайте вопрос..."
            :disabled="isLoading"
          />
          <button
            type="submit"
            class="send-btn"
            :disabled="!input.trim() || isLoading"
          >
            <UiIcon name="send" :size="18" color="currentColor" />
          </button>
        </form>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { UiIcon, UiText } from '@fastio/ui'
import { useAiChat } from '~/composables/useAiChat'

const isOpen = ref(false)
const messagesRef = ref<HTMLElement>()

const { messages, input, handleSubmit, isLoading, error, reload } = useAiChat()

function onSubmit() {
  if (!input.value.trim()) return
  handleSubmit()
}

function clearChat() {
  messages.value = []
}

watch(
  () => messages.value.length,
  async () => {
    await nextTick()
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight
    }
  },
)
</script>

<style scoped lang="scss">
.ai-chat-root {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 200;
}

.fab {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: none;
  background: var(--color-primary);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: background 0.2s, transform 0.2s;

  &:hover {
    background: var(--color-primary-hover);
    transform: scale(1.05);
  }

  &.active {
    background: var(--grey-600);
  }
}

.panel {
  position: absolute;
  bottom: 64px;
  right: 0;
  width: 380px;
  max-width: calc(100vw - 48px);
  height: 520px;
  max-height: calc(100vh - 120px);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  box-shadow: var(--box-shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-primary);
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-title);
}

.clear-btn {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  transition: color 0.15s, background 0.15s;

  &:hover {
    color: var(--color-error);
    background: var(--color-error-light);
  }
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 100%;
  text-align: center;
  padding: 24px;
}

.empty-text {
  color: var(--color-text-hint);
  line-height: 1.5;
}

.message {
  display: flex;

  &.user {
    justify-content: flex-end;

    .bubble {
      background: var(--color-primary);
      color: #fff;
      border-radius: 16px 16px 4px 16px;
    }
  }

  &.assistant {
    justify-content: flex-start;

    .bubble {
      background: var(--color-bg-subtle);
      color: var(--color-text);
      border-radius: 16px 16px 16px 4px;
    }
  }
}

.bubble {
  max-width: 85%;
  padding: 10px 14px;
  font-size: 13px;
  line-height: 1.5;
  word-break: break-word;
  white-space: pre-wrap;
}

.typing {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 12px 18px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-text-secondary);
  animation: typing-bounce 1.4s infinite ease-in-out;

  &:nth-child(2) {
    animation-delay: 0.2s;
  }

  &:nth-child(3) {
    animation-delay: 0.4s;
  }
}

@keyframes typing-bounce {
  0%, 80%, 100% {
    transform: scale(0.6);
    opacity: 0.4;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

.message-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--color-error-light);
  border-radius: 8px;
}

.error-text {
  color: var(--color-error);
}

.retry-btn {
  background: none;
  border: none;
  color: var(--color-primary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;

  &:hover {
    text-decoration: underline;
  }
}

.input-area {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid var(--color-border);
}

.chat-input {
  flex: 1;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 13px;
  background: var(--color-bg-card);
  color: var(--color-text);
  outline: none;
  transition: border-color 0.15s;

  &::placeholder {
    color: var(--color-text-tertiary);
  }

  &:focus {
    border-color: var(--color-primary);
  }
}

.send-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: none;
  background: var(--color-primary);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, opacity 0.15s;
  flex-shrink: 0;

  &:hover:not(:disabled) {
    background: var(--color-primary-hover);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

// Transition
.chat-panel-enter-active,
.chat-panel-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.chat-panel-enter-from,
.chat-panel-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.95);
}
</style>
