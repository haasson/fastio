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

        <div class="disclaimer">
          AI может ошибаться. Загляните в <a :href="helpUrl" target="_blank" rel="noopener">базу знаний</a> или напишите в <a href="/help/support" @click.prevent="goToSupport">поддержку</a>
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
            <div
              v-if="message.role === 'user'"
              class="bubble"
            >{{ messageText(message) }}</div>
            <div
              v-else
              class="bubble markdown-body"
              @click="handleLinkClick"
              v-html="renderMarkdown(messageText(message))"
            />
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
import { Marked } from 'marked'
import DOMPurify from 'dompurify'
import type { UIMessage } from 'ai'
import { useRouter, useRuntimeConfig } from '#imports'
import { UiIcon, UiText } from '@fastio/ui'
import { useAiChat } from '~/composables/useAiChat'
import useTour from '~/composables/useTour'

const isOpen = ref(false)
const { isActive: isTourActive } = useTour()

watch(isTourActive, (active) => {
  if (active) isOpen.value = false
})
const messagesRef = ref<HTMLElement>()
const router = useRouter()
const helpUrl = useRuntimeConfig().public.helpUrl

const { messages, input, handleSubmit, isLoading, error, reload, clearMessages } = useAiChat()

const md = new Marked({ breaks: true, gfm: true })

function messageText(m: UIMessage): string {
  if (!m.parts) return ''

  return m.parts
    .filter((p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text')
    .map((p) => p.text)
    .join('')
}

function renderMarkdown(text: string): string {
  if (!text) return ''
  const html = md.parse(text, { async: false }) as string

  return DOMPurify.sanitize(html, { ADD_ATTR: ['target'] })
}

function handleLinkClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  const anchor = target.closest('a')

  if (!anchor) return
  const href = anchor.getAttribute('href')

  if (href && href.startsWith('/')) {
    event.preventDefault()
    router.push(href)
  }
}

function goToSupport() {
  router.push('/help/support')
  isOpen.value = false
}

function onSubmit() {
  if (!input.value.trim()) return
  handleSubmit()
}

function clearChat() {
  clearMessages()
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
@use '@fastio/styles/mixins/layout' as *;

.ai-chat-root {
  position: fixed;
  bottom: var(--space-24);
  right: var(--space-24);
  z-index: 200;
}

.fab {
  @include flex-center;

  width: 52px;
  height: 52px;
  border-radius: var(--radius-full);
  border: none;
  background: var(--color-primary);
  color: var(--color-white);
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: background var(--transition-base), transform var(--transition-base);

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
  border-radius: var(--radius-16);
  box-shadow: var(--box-shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  @include flex-row(var(--space-8));

  padding: var(--space-12) var(--space-16);
  border-bottom: 1px solid var(--color-border);
  color: var(--color-primary);
}

.panel-title {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-title);
}

.clear-btn {
  @include flex-row(0);
  @include button-reset;

  margin-left: auto;
  color: var(--color-text-secondary);
  padding: var(--space-4);
  border-radius: var(--radius-8);
  transition: color var(--transition-fast), background var(--transition-fast);

  &:hover {
    color: var(--color-error);
    background: var(--color-error-light);
  }
}

.disclaimer {
  padding: var(--space-8) var(--space-16);
  font-size: var(--font-size-xs);
  line-height: var(--line-height-base);
  color: var(--color-text-secondary);
  text-align: center;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;

  a {
    color: var(--color-primary);
    text-decoration: underline;
    cursor: pointer;

    &:hover {
      text-decoration: none;
    }
  }
}

.messages {
  @include flex-col(var(--space-12));

  flex: 1;
  overflow-y: auto;
  padding: var(--space-16);
}

.empty {
  @include flex-col(var(--space-12));

  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  padding: var(--space-24);
}

.empty-text {
  color: var(--color-text-hint);
  line-height: var(--line-height-loose);
}

.message {
  display: flex;

  &.user {
    justify-content: flex-end;

    .bubble {
      background: var(--color-primary);
      color: var(--color-white);
      border-radius: var(--radius-16) var(--radius-16) var(--radius-4) var(--radius-16);
    }
  }

  &.assistant {
    justify-content: flex-start;

    .bubble {
      background: var(--color-bg-subtle);
      color: var(--color-text);
      border-radius: var(--radius-16) var(--radius-16) var(--radius-16) var(--radius-4);
    }
  }
}

.bubble {
  max-width: 85%;
  padding: var(--space-8) var(--space-12);
  font-size: var(--font-size-base);
  line-height: var(--line-height-loose);
  word-break: break-word;
  white-space: pre-wrap;
}

.typing {
  @include flex-row(var(--space-4));

  padding: var(--space-12) var(--space-16);
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
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
  @include flex-row(var(--space-8));

  padding: var(--space-8) var(--space-12);
  background: var(--color-error-light);
  border-radius: var(--radius-8);
}

.error-text {
  color: var(--color-error);
}

.retry-btn {
  @include button-reset;

  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;

  &:hover {
    text-decoration: underline;
  }
}

.input-area {
  @include flex-row(var(--space-8));

  padding: var(--space-12);
  border-top: 1px solid var(--color-border);
}

.chat-input {
  flex: 1;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
  padding: var(--space-8) var(--space-12);
  font-size: var(--font-size-base);
  background: var(--color-bg-card);
  color: var(--color-text);
  outline: none;
  transition: border-color var(--transition-fast);

  &::placeholder {
    color: var(--color-text-secondary);
  }

  &:focus {
    border-color: var(--color-primary);
  }
}

.send-btn {
  @include flex-center;
  @include button-reset;

  width: 36px;
  height: 36px;
  border-radius: var(--radius-8);
  background: var(--color-primary);
  color: var(--color-white);
  transition: background var(--transition-fast), opacity var(--transition-fast);
  flex-shrink: 0;

  &:hover:not(:disabled) {
    background: var(--color-primary-hover);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.markdown-body {
  white-space: normal;

  :deep(p) {
    margin: 0 0 var(--space-8);

    &:last-child {
      margin-bottom: 0;
    }
  }

  :deep(a) {
    color: var(--color-primary);
    text-decoration: underline;

    &:hover {
      text-decoration: none;
    }
  }

  :deep(ul), :deep(ol) {
    margin: var(--space-4) 0;
    padding-left: var(--space-20);
  }

  :deep(ul) {
    list-style: disc;
  }

  :deep(ol) {
    list-style: decimal;
  }

  :deep(li) {
    margin-bottom: var(--space-4);

    ul {
      list-style: circle;
      margin: var(--space-4) 0;
    }
  }

  :deep(strong) {
    font-weight: var(--font-weight-semibold);
  }

  :deep(code) {
    background: var(--color-bg-subtle);
    padding: var(--space-4);
    border-radius: var(--radius-4);
    font-size: var(--font-size-sm);
  }
}

// Transition
.chat-panel-enter-active,
.chat-panel-leave-active {
  transition: opacity var(--transition-base) ease, transform var(--transition-base) ease;
}

.chat-panel-enter-from,
.chat-panel-leave-to {
  opacity: 0;
  transform: translateY(var(--space-12)) scale(0.95);
}
</style>
