<template>
  <button class="burger-root" :class="{ open }" :aria-label="open ? 'Закрыть меню' : 'Открыть меню'" @click="$emit('click')">
    <span />
    <span />
    <span />
  </button>
</template>

<script setup lang="ts">
defineProps<{ open?: boolean }>()
defineEmits<{ click: [] }>()
</script>

<style scoped lang="scss">
.burger-root {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  width: 32px;
  height: 32px;

  span {
    display: block;
    width: 22px;
    height: 2px;
    background: #333;
    border-radius: 2px;
    transition: transform 0.2s, opacity 0.2s;
    transform-origin: center;
  }

  &.open {
    span:nth-child(1) {
      transform: translateY(7px) rotate(45deg);
    }

    span:nth-child(2) {
      opacity: 0;
    }

    span:nth-child(3) {
      transform: translateY(-7px) rotate(-45deg);
    }
  }
}
</style>
