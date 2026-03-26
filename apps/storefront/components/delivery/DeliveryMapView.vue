<template>
  <div class="map-view-root">
    <div class="map-body">
      <div
        ref="mapRoot"
        class="map-wrap"
        @mousemove="onMouseMove"
        @mouseleave="hoveredZone = null"
      >
        <YandexMap
          v-model="mapInstance"
          :settings="mapSettings"
          width="100%"
          height="100%"
        >
          <YandexMapDefaultSchemeLayer :settings="{ theme: props.dark ? 'dark' : 'light' }" />
          <YandexMapDefaultFeaturesLayer />
          <YandexMapControls :settings="{ position: 'right' }">
            <YandexMapZoomControl />
          </YandexMapControls>
          <YandexMapFeature
            v-for="s in zoneFeatureSettings"
            :key="s.id"
            :settings="s"
          />
          <YandexMapListener :settings="listenerSettings" />
        </YandexMap>

        <!-- Desktop tooltip -->
        <div
          v-if="hoveredZone && !isMobile"
          class="tooltip"
          :style="{ left: `${tooltipPos.x + 14}px`, top: `${tooltipPos.y + 14}px` }"
        >
          <FsText as="span" variant="caption" :weight="600">{{ hoveredZone.name }}</FsText>
          <FsText as="span" variant="xs" color="secondary" class="tooltip-text">{{ formatZoneConditions(hoveredZone, currency) }}</FsText>
        </div>
      </div>
    </div>

    <FsText variant="xs" color="secondary" align="center">
      {{ isMobile ? 'Нажмите на зону, чтобы узнать условия доставки' : 'Наведите на зону, чтобы узнать условия доставки' }}
    </FsText>

    <FsDrawer v-model="drawerOpen" :title="selectedZone?.name" size="sm">
      <div v-if="selectedZone" class="drawer-info">
        <FsText variant="body-sm" class="drawer-conditions">{{ formatZoneConditions(selectedZone, currency) }}</FsText>
      </div>
    </FsDrawer>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, computed, watch } from 'vue'
import {
  YandexMap,
  YandexMapDefaultSchemeLayer,
  YandexMapDefaultFeaturesLayer,
  YandexMapFeature,
  YandexMapListener,
  YandexMapControls,
  YandexMapZoomControl,
} from 'vue-yandex-maps'
import type { YandexMapListenerSettings } from 'vue-yandex-maps'
import { FsDrawer, FsText } from '@fastio/public-ui'
import type { DeliveryZone } from '@fastio/shared'
import { findDeliveryZone } from '@fastio/shared'
import { useIsMobile } from '~/composables/useIsMobile'
import { useCurrency } from '~/composables/useCurrency'
import { formatZoneConditions } from '~/utils/deliveryText'

type Props = {
  zones: DeliveryZone[]
  dark?: boolean
}

const props = defineProps<Props>()

const isMobile = useIsMobile()
const currency = useCurrency()

const mapRoot = ref<HTMLElement | null>(null)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapInstance = shallowRef<any>(null)

const hoveredZone = ref<DeliveryZone | null>(null)
const selectedZone = ref<DeliveryZone | null>(null)
const drawerOpen = ref(false)
const tooltipPos = ref({ x: 0, y: 0 })

const allPoints = computed((): [number, number][] =>
  props.zones.flatMap((z) => z.coordinates),
)

const initialCenter = computed((): [number, number] => {
  const pts = allPoints.value
  if (pts.length === 0) return [37.617617, 55.755864]
  const avgLng = pts.reduce((s, p) => s + p[0], 0) / pts.length
  const avgLat = pts.reduce((s, p) => s + p[1], 0) / pts.length
  return [avgLng, avgLat]
})

const mapSettings = computed(() => ({ location: { center: initialCenter.value, zoom: 10 } }))

const fitBounds = () => {
  const pts = allPoints.value
  if (pts.length === 0) return

  let minLng = Infinity, maxLng = -Infinity
  let minLat = Infinity, maxLat = -Infinity

  for (const [lng, lat] of pts) {
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }

  const lngPad = Math.max((maxLng - minLng) * 0.1, 0.005)
  const latPad = Math.max((maxLat - minLat) * 0.1, 0.005)

  if (mapInstance.value) {
    mapInstance.value.setLocation({
      bounds: [
        [minLng - lngPad, minLat - latPad],
        [maxLng + lngPad, maxLat + latPad],
      ],
      duration: 300,
    })
  }
}

watch(allPoints, () => fitBounds(), { flush: 'post' })
watch(mapInstance, () => fitBounds())

const onMouseMove = (e: MouseEvent) => {
  if (!mapRoot.value) return
  const rect = mapRoot.value.getBoundingClientRect()
  tooltipPos.value = { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const zoneFeatureSettings = computed(() =>
  props.zones.map((zone) => ({
    id: zone.id,
    geometry: {
      type: 'Polygon' as const,
      coordinates: [zone.coordinates],
    },
    style: {
      stroke: [{ color: zone.color, width: 2 }],
      fill: hexToRgba(zone.color, 0.2),
    },
  })),
)

const listenerSettings = computed((): YandexMapListenerSettings => ({
  onMouseMove: (_obj: unknown, event: { coordinates: [number, number] }) => {
    if (isMobile.value) return
    const found = findDeliveryZone(event.coordinates, props.zones)
    hoveredZone.value = found ?? null
  },
  onMouseLeave: () => { hoveredZone.value = null },
  onClick: (_obj: unknown, event: { coordinates: [number, number] }) => {
    if (!isMobile.value) return
    const found = findDeliveryZone(event.coordinates, props.zones)
    if (!found) return
    selectedZone.value = found
    drawerOpen.value = true
  },
}))
</script>

<style scoped lang="scss">
.map-view-root {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Структура как в админке: родитель с явной высотой + overflow:hidden,
   внутри flex-контейнер, карта через height:100% заполняет его */
.map-body {
  height: 400px;
  min-height: 400px;
  display: flex;
  position: relative;
  overflow: hidden;

  @media (min-width: 768px) {
    height: 500px;
  }
}

.map-wrap {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.tooltip {
  position: absolute;
  z-index: 10;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  padding: 8px 12px;
  pointer-events: none;
  max-width: 220px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tooltip-text {
  white-space: pre-line;
}

.drawer-info {
  padding-top: 4px;
}

.drawer-conditions {
  white-space: pre-line;
}

</style>
