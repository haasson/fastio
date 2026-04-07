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
import { formatRelativeDate } from '~/utils/formatRelativeDate'

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
      border-radius: 16px 16px 4px 16px;
    }
  }

  &:not(.mine) {
    .bubble {
      background: var(--color-bg-page);
      border-radius: 16px 16px 16px 4px;
    }
  }
}

.bubble {
  max-width: 75%;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.body {
  white-space: pre-wrap;
  word-break: break-word;
}

.images {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.image-link {
  width: 120px;
  height: 90px;
  border-radius: 8px;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.time {
  align-self: flex-end;
  font-size: 12px;
  line-height: 1.3;
  color: var(--color-text-secondary);
}
</style>
