<template>
  <UiCard
    size="small"
    class="item-card"
    :class="{ inactive: !active }"
    @click="emit('click')"
  >
    <UiSpace :size="8" vertical>
      <div class="card-photo">
        <img v-if="photo" :src="photo" :alt="name" />
        <UiPhotoPlaceholder v-else size="medium" />
      </div>
      <span class="card-name">{{ name }}</span>
      <UiSpace :size="4" align="center">
        <span class="card-price">{{ formatPrice(price) }}</span>
        <UiTag
          v-for="tagId in tags"
          :key="tagId"
          size="tiny"
          empty
          round
          :style="tagStyle(tagId)"
        >{{ tagName(tagId) }}</UiTag>
      </UiSpace>
      <div class="card-actions">
        <UiSwitch
          :model-value="active"
          @click.stop
          @update:model-value="emit('toggle-active', $event)"
        />
        <AppActionsBlock
          :show-edit="false"
          @click.stop
          @delete="emit('delete')"
        />
      </div>
    </UiSpace>
  </UiCard>
</template>

<script setup lang="ts">
import { UiCard, UiPhotoPlaceholder, UiSpace, UiSwitch, UiTag } from '@fastio/ui'
import { formatPrice } from '@fastio/shared'
import AppActionsBlock from '~/components/ui/AppActionsBlock.vue'

defineProps<{
  photo?: string | null
  name: string
  price: number
  tags: string[]
  active: boolean
  tagName: (id: string) => string
  tagStyle: (id: string) => Record<string, string | undefined>
}>()

const emit = defineEmits<{
  'click': []
  'toggle-active': [value: boolean]
  'delete': []
}>()
</script>

<style scoped lang="scss">
.item-card {
  cursor: pointer;

  &.inactive { opacity: 0.5; }
}

.card-photo {
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 12px;
  overflow: hidden;
  background: var(--color-bg-page);
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.card-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-title);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-price {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-primary);
  white-space: nowrap;
}

.card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
