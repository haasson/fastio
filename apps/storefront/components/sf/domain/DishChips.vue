<template>
  <div class="chips-root">
    <SfText variant="body-sm" class="chips-title">{{ title }}</SfText>
    <div class="chips-list">
      <!-- Toggle mode: items start active, clicking "removes" them -->
      <template v-if="mode === 'toggle'">
        <SfTag
          v-for="item in items"
          :key="item.id"
          size="small"
          :removed="modelValue.includes(item.id)"
          @click="onToggle(item.id)"
        >
          {{ item.label }}
        </SfTag>
      </template>

      <!-- Radio mode: one selected -->
      <template v-else-if="mode === 'radio'">
        <SfTag
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
        </SfTag>
      </template>

      <!-- Checkbox mode: multiple selected -->
      <template v-else>
        <SfTag
          v-for="item in items"
          :key="item.id"
          as="label"
          size="small"
          :active="modelValue.includes(item.id)"
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
        </SfTag>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import SfText from '~/components/sf/typography/SfText.vue'
import SfTag from '~/components/sf/base/SfTag.vue'

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
  } else {
    emit('update:modelValue', [...props.modelValue, id])
  }
}

function onRadio(id: string) {
  emit('update:modelValue', [id])
}

</script>

<style scoped lang="scss">
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
  font-size: 12px;
  color: var(--color-text-muted);
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
