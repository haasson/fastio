<template>
  <Teleport to="body">
    <Transition name="mobile-menu">
      <div v-if="modelValue" class="fs-mobile-menu-root" @click.self="emit('update:modelValue', false)">
        <slot />
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { watch, onUnmounted } from 'vue'

type Props = {
  modelValue: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

watch(() => props.modelValue, (open) => {
  if (typeof document !== 'undefined') {
    document.body.style.overflow = open ? 'hidden' : ''
  }
})

onUnmounted(() => {
  if (typeof document !== 'undefined') document.body.style.overflow = ''
})
</script>

<style scoped lang="scss">
@use '../../styles/mixins' as *;

.fs-mobile-menu-root {
  position: fixed;
  top: var(--header-height, 61px);
  left: 0;
  right: 0;
  bottom: 0;
  z-index: var(--z-mobile-menu, 150);
  background: var(--mobile-menu-bg, var(--color-bg, #fff));
  display: flex;
  flex-direction: column;
  padding: 24px 24px 40px;
  overflow-y: auto;
  font-family: var(--font-family, inherit);

  @include md { display: none; }
}

.mobile-menu-enter-active,
.mobile-menu-leave-active {
  transition: opacity 0.2s ease, transform 0.25s cubic-bezier(0.32, 0.72, 0, 1);
}

.mobile-menu-enter-from,
.mobile-menu-leave-to {
  opacity: 0;
  transform: translateY(-16px);
}
</style>
