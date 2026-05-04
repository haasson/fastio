<template>
  <div class="address-with-map">
    <AddressSuggestInput
      v-model="address"
      v-model:address-data="addressData"
      :name="name"
      :placeholder="placeholder"
      :rules="rules"
      @pick="onPick"
    />

    <div class="coords-block">
      <UiText size="small" class="coords-label">{{ mapLabel }}</UiText>
      <div class="coords-map" :style="{ height: `${mapHeight}px` }">
        <YandexMap
          :settings="miniMapSettings"
          width="100%"
          height="100%"
        >
          <YandexMapDefaultSchemeLayer />
          <YandexMapDefaultFeaturesLayer />
          <YandexMapMarker
            v-if="latitude != null && longitude != null"
            :settings="{ coordinates: [longitude, latitude] }"
          >
            <div class="coords-pin" />
          </YandexMapMarker>
        </YandexMap>
      </div>
      <UiText v-if="latitude != null && longitude != null" size="tiny" class="coords-hint">
        {{ latitude.toFixed(6) }}, {{ longitude.toFixed(6) }}
      </UiText>
      <UiText v-else size="tiny" class="coords-hint">Введите адрес — точка появится автоматически</UiText>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  YandexMap,
  YandexMapDefaultSchemeLayer,
  YandexMapDefaultFeaturesLayer,
  YandexMapMarker,
} from 'vue-yandex-maps'
import { UiText } from '@fastio/ui'
import type { ValidationRule } from '@fastio/kit'
import AddressSuggestInput from '~/components/ui/AddressSuggestInput.vue'
import type { DadataSuggestion } from '~/composables/delivery/useDadataSuggestions'
import type { BranchAddressData } from '@fastio/shared'

withDefaults(defineProps<{
  name?: string
  placeholder?: string
  rules?: ValidationRule[]
  mapLabel?: string
  mapHeight?: number
}>(), {
  placeholder: 'ул. Ленина, 1',
  mapLabel: 'Точка на карте',
  mapHeight: 240,
})

const address = defineModel<string>('address', { default: '' })
const addressData = defineModel<BranchAddressData | null>('addressData', { default: null })
const latitude = defineModel<number | null>('latitude', { default: null })
const longitude = defineModel<number | null>('longitude', { default: null })

const MOSCOW: [number, number] = [37.617617, 55.755864]

const miniMapSettings = computed(() => {
  const center = latitude.value != null && longitude.value != null
    ? [longitude.value, latitude.value] as [number, number]
    : MOSCOW

  return { location: { center, zoom: 14 } }
})

const onPick = (s: DadataSuggestion) => {
  if (s.data.geo_lat && s.data.geo_lon) {
    latitude.value = parseFloat(s.data.geo_lat)
    longitude.value = parseFloat(s.data.geo_lon)
  }
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.address-with-map {
  @include flex-col(var(--space-16));
}

.coords-block {
  @include flex-col(var(--space-8));
}

.coords-label {
  font-weight: var(--font-weight-medium);
}

.coords-map {
  border-radius: var(--radius-8);
  overflow: hidden;
  border: 1px solid var(--color-border-light);
}

.coords-pin {
  width: 14px;
  height: 14px;
  background: var(--color-primary);
  border: 2px solid var(--color-white);
  border-radius: var(--radius-full);
  box-shadow: var(--box-shadow);
  transform: translate(-50%, -50%);
}

.coords-hint {
  color: var(--color-text-hint);
}
</style>
