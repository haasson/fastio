<template>
  <div
    class="empty-root"
    :class="`size-${size}`"
  >
    <div class="empty-icon">
      <slot />
    </div>
    <SfText as="p" variant="body-sm" color="secondary" class="empty-title">{{ title }}</SfText>
    <SfText v-if="description" as="p" variant="caption" color="muted" class="empty-desc">{{ description }}</SfText>
    <div v-if="$slots.action" class="empty-action">
      <slot name="action" />
    </div>
  </div>
</template>
<script setup lang="ts">
import SfText from '~/components/sf/typography/SfText.vue'

type Props = {
  title: string
  description?: string
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
})
</script>
<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.empty-root {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
  color: var(--color-text-muted);
}

.empty-icon {
  opacity: 0.4;
}

.empty-title {
  font-weight: 600;
}

.empty-desc {
  max-width: 320px;
}

.empty-action {
  margin-top: 4px;
}

// Sizes
.size-sm {
  padding: 24px;

  .empty-icon {
    font-size: 32px;

    :deep(svg) {
      width: 32px;
      height: 32px;
    }
  }

  .empty-title {
    font-size: 16px;
    @include lg { font-size: 18px; }
  }
}

.size-md {
  padding: 40px;

  .empty-icon {
    font-size: 48px;

    :deep(svg) {
      width: 48px;
      height: 48px;
    }
  }

  .empty-title {
    font-size: 20px;
    @include lg { font-size: 24px; }
  }
}

.size-lg {
  padding: 64px;

  .empty-icon {
    font-size: 64px;

    :deep(svg) {
      width: 64px;
      height: 64px;
    }
  }

  .empty-title {
    font-size: 24px;
    @include lg { font-size: 28px; }
  }
}
</style>
