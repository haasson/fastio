<template>
  <button
    class="toggle-root"
    :class="{ on: modelValue }"
    role="switch"
    :aria-checked="modelValue"
    type="button"
    @click="$emit('update:modelValue', !modelValue)"
  />
</template>

<script setup lang="ts">
defineProps<{ modelValue: boolean }>()
defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<style scoped>
.toggle-root {
  width: 40px;
  height: 22px;
  border-radius: 11px;
  background: #ddd;
  border: none;
  cursor: pointer;
  position: relative;
  flex-shrink: 0;
  transition: background 0.2s;
}

.toggle-root::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s;
}

.toggle-root.on {
  background: #ff6b35;
}

.toggle-root.on::after {
  transform: translateX(18px);
}
</style>
