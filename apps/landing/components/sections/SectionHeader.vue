<template>
  <div class="section-header-root">
    <span v-if="label" class="label" :class="{ 'label-muted': muted }">{{ label }}</span>

    <h2 v-if="$slots.heading" class="heading" :class="{ 'heading-dark': dark }">
      <slot name="heading" />
    </h2>

    <p v-if="$slots.subtitle" class="subtitle" :class="{ 'subtitle-dark': dark }">
      <slot name="subtitle" />
    </p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label?: string
  dark?: boolean
  muted?: boolean
}>()
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.section-header-root {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 40px;

  @media (min-width: 768px) {
    margin-bottom: 48px;
  }
}

.label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  @include text-xs(600);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ln-accent);
  margin-bottom: 16px;

  &::before {
    content: '';
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--ln-accent);
  }

  &.label-muted {
    color: var(--ln-muted);

    &::before {
      background: var(--ln-muted);
    }
  }
}

.heading {
  font-family: var(--heading-font-family);
  font-weight: 700;
  font-size: 22px;
  line-height: 1.25;
  color: var(--ln-white);
  margin: 0 0 12px;
  text-align: center;
  max-width: 640px;

  &.heading-dark {
    color: var(--ln-black);
  }

  :deep(em) {
    color: var(--ln-accent);
    font-style: normal;
  }

  @media (min-width: 768px) {
    font-size: 28px;
  }

  @media (min-width: 1280px) {
    font-size: 32px;
  }
}

.subtitle {
  @include text-body-sm;
  color: var(--color-text-secondary);
  margin: 0;
  max-width: 520px;
  text-align: center;
  line-height: 1.6;

  &.subtitle-dark {
    color: #4a4744;
  }
}
</style>
