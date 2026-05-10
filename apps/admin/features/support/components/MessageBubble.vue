<template>
  <div class="bubble-root" :class="{ mine: isMine }">
    <div class="bubble">
      <UiText size="small" class="body">{{ message.body }}</UiText>
      <div v-if="message.imageUrls?.length" class="images">
        <a
          v-for="(url, i) in message.imageUrls"
          :key="i"
          :href="url"
          target="_blank"
          class="image-link"
        >
          <img :src="url" alt="" />
        </a>
      </div>
      <span class="time">{{ formatRelativeDate(message.createdAt) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { UiText } from '@fastio/ui'
import type { SupportMessage } from '@fastio/shared'
import { formatRelativeDate } from '~/shared/utils/formatRelativeDate'

defineProps<{
  message: SupportMessage
  isMine: boolean
}>()
</script>

<style scoped lang="scss">
.bubble-root {
  display: flex;

  &.mine {
    justify-content: flex-end;

    .bubble {
      background: var(--color-primary-light);
      border-radius: var(--radius-16) var(--radius-16) var(--radius-4) var(--radius-16);
    }
  }

  &:not(.mine) {
    .bubble {
      background: var(--color-bg-page);
      border-radius: var(--radius-16) var(--radius-16) var(--radius-16) var(--radius-4);
    }
  }
}

.bubble {
  max-width: 75%;
  padding: var(--space-8) var(--space-12);
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.body {
  white-space: pre-wrap;
  word-break: break-word;
}

.images {
  display: flex;
  gap: var(--space-8);
  flex-wrap: wrap;
}

.image-link {
  width: 120px;
  height: 90px;
  border-radius: var(--radius-8);
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.time {
  align-self: flex-end;
  font-size: var(--font-size-sm);
  line-height: var(--line-height-base);
  color: var(--color-text-secondary);
}
</style>
