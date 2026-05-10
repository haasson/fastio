<template>
  <Transition name="bar">
    <div v-if="form && form.isDirty.value" class="bar-root">
      <UiText size="tiny" class="bar-status">Есть несохранённые изменения</UiText>
      <div class="bar-actions">
        <UiButton
          round
          size="large"
          :disabled="form.saving.value"
          @click="onReset"
        >
          Отменить
        </UiButton>
        <UiButton
          round
          size="large"
          type="primary"
          :loading="form.saving.value"
          @click="onSubmit"
        >
          Сохранить
        </UiButton>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { UiButton, UiText } from '@fastio/ui'
import { useEventListener } from '@vueuse/core'
import { usePageForm } from '~/shared/ui/composables/usePageForm'

const form = usePageForm()

const onSubmit = async () => {
  if (!form.value || !form.value.isDirty.value || form.value.saving.value) return
  try {
    await form.value.submit()
  } catch {
    // ошибки/тосты — забота save callback'а; бар просто не падает
  }
}

const onReset = () => form.value?.reset()

useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    if (!form.value?.isDirty.value) return
    e.preventDefault()
    onSubmit()
  }
})
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as *;

.bar-root {
  position: fixed;
  bottom: max(var(--space-16), env(safe-area-inset-bottom));
  left: var(--current-sidebar-width, 0);
  right: 0;
  margin-inline: auto;
  width: fit-content;
  max-width: calc(100vw - var(--space-32));
  z-index: 40;

  display: flex;
  align-items: center;
  gap: var(--space-20);
  padding: var(--space-8) var(--space-8) var(--space-8) var(--space-24);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  box-shadow: var(--box-shadow);
}

.bar-status {
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.bar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.bar-enter-active,
.bar-leave-active {
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease;
}

.bar-enter-from,
.bar-leave-to {
  transform: translateY(calc(100% + var(--space-16))) scale(0.95);
  opacity: 0;
}
</style>
