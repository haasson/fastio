<template>
  <div class="chips-root">
    <FsText variant="body-sm" class="chips-title">{{ title }}</FsText>
    <div class="chips-list">
      <!-- Toggle mode: items start active, clicking "removes" them -->
      <template v-if="mode === 'toggle'">
        <FsTag
          v-for="item in items"
          :key="item.id"
          size="small"
          :removed="modelValue.includes(item.id)"
          @click="onToggle(item.id)"
        >
          {{ item.label }}
        </FsTag>
      </template>

      <!-- Radio mode: one selected -->
      <template v-else-if="mode === 'radio'">
        <FsTag
          v-for="item in items"
          :key="item.id"
          as="label"
          size="small"
          :active="modelValue.includes(item.id)"
        >
          <input
            type="radio"
            :name="groupName"
            :value="item.id"
            :checked="modelValue.includes(item.id)"
            class="visually-hidden"
            @change="onRadio(item.id)"
          />
          {{ item.label }}
          <span v-if="item.priceDelta && item.priceDelta > 0" class="chip-price">
            +{{ item.priceDelta }} {{ currency }}
          </span>
        </FsTag>
      </template>

      <!-- Checkbox mode: multiple selected -->
      <template v-else>
        <FsTag
          v-for="item in items"
          :key="item.id"
          as="label"
          size="small"
          :active="modelValue.includes(item.id)"
          :disabled="disabledSelect && !modelValue.includes(item.id)"
        >
          <input
            type="checkbox"
            :checked="modelValue.includes(item.id)"
            class="visually-hidden"
            @change="onToggle(item.id)"
          />
          {{ item.label }}
          <span v-if="item.priceDelta && item.priceDelta > 0" class="chip-price">
            +{{ item.priceDelta }} {{ currency }}
          </span>
        </FsTag>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FsText, FsTag } from '@fastio/public-ui'

type ChipItem = {
  id: string
  label: string
  priceDelta?: number
}

type Props = {
  title: string
  items: ChipItem[]
  mode: 'radio' | 'checkbox' | 'toggle'
  modelValue: string[]
  disabledSelect?: boolean
  currency?: string
  groupName?: string
}

const props = withDefaults(defineProps<Props>(), {
  currency: '₽',
  groupName: 'chips',
})

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

function onToggle(id: string) {
  if (props.modelValue.includes(id)) {
    emit('update:modelValue', props.modelValue.filter((v) => v !== id))
  } else if (!props.disabledSelect) {
    emit('update:modelValue', [...props.modelValue, id])
  }
}

function onRadio(id: string) {
  emit('update:modelValue', [id])
}

</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.chips-root {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chips-title {
  font-weight: 600;
  color: var(--color-text);
}

.chips-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip-price {
  @include text-xs;
  color: var(--color-text-secondary);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}
</style>
