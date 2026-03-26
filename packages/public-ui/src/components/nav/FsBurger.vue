<template>
  <button
    class="fs-burger-root"
    :class="{ active: modelValue }"
    :aria-label="modelValue ? 'Закрыть' : 'Меню'"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span class="line" />
    <span class="line" />
    <span class="line" />
  </button>
</template>

<script setup lang="ts">
type Props = {
  modelValue: boolean
}

defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<style scoped lang="scss">
@use '../../styles/mixins' as *;

.fs-burger-root {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 5px;
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  flex-shrink: 0;

  @include lg { display: none; }
}

.line {
  width: 22px;
  height: 2px;
  border-radius: 2px;
  background: var(--burger-color, var(--color-text));
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.active {
  .line:nth-child(1) { transform: translateY(7px) rotate(45deg); }
  .line:nth-child(2) { opacity: 0; }
  .line:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }
}
</style>
