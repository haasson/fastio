<template>
  <div ref="mapRoot" class="map-root">
    <!-- key меняется при toggle fullscreen, чтобы карта пересоздалась с правильными размерами -->
    <YandexMap
      :key="mapKey"
      v-model="mapInstance"
      :settings="mapSettings"
      width="100%"
      height="100%"
      :cursor-grab="!drawing"
    >
      <YandexMapDefaultSchemeLayer :settings="{ theme: isDark ? 'dark' : 'light' }" />
      <YandexMapDefaultFeaturesLayer />

      <!-- Zoom controls -->
      <YandexMapControls :settings="{ position: 'right' }">
        <YandexMapZoomControl />
      </YandexMapControls>

      <!-- Fullscreen button -->
      <YandexMapControls :settings="{ position: 'top right' }">
        <YandexMapControlButton :settings="{ onClick: toggleFullscreen }">
          <UiIcon :name="isFullscreen ? 'minimize' : 'maximize'" :size="18" color="#333" />
        </YandexMapControlButton>
      </YandexMapControls>

      <!-- Branch markers -->
      <YandexMapMarker
        v-for="b in branchesWithCoords"
        :key="b.id"
        :settings="{ coordinates: [b.longitude!, b.latitude!] }"
      >
        <div class="branch-marker" :class="{ selected: b.id === selectedBranchId }" :style="{ '--branch-color': b.color }">
          <span class="branch-marker-dot" />
          <div class="branch-marker-pill">
            <span class="branch-marker-label">{{ b.name }}</span>
          </div>
        </div>
      </YandexMapMarker>

      <!-- Existing zones -->
      <YandexMapFeature
        v-for="zone in zones"
        :key="zone.id"
        :settings="getZoneFeatureSettings(zone)"
      />

      <!-- Draw: placed point dots -->
      <YandexMapMarker
        v-for="(pt, i) in drawing ? drawPoints : []"
        :key="`draw-pt-${i}`"
        :settings="{ coordinates: pt }"
      >
        <div class="draw-point" :class="{ first: i === 0, snap: i === 0 && nearFirstPoint }" />
      </YandexMapMarker>

      <!-- Draw: placed line segments -->
      <YandexMapFeature
        v-if="drawing && drawPoints.length >= 2"
        :settings="getDrawLinesSettings()"
      />

      <!-- Draw: polygon fill preview -->
      <YandexMapFeature
        v-if="drawing && drawPoints.length >= 3"
        :settings="getDrawFillSettings()"
      />

      <!-- Draw: rubber band line to cursor -->
      <YandexMapFeature
        v-if="drawing && drawPoints.length >= 1 && cursorCoords"
        :settings="getRubberBandSettings()"
      />

      <!-- Draw: closing rubber band line (cursor → first point) when near snap -->
      <YandexMapFeature
        v-if="drawing && nearFirstPoint && cursorCoords"
        :settings="getClosingRubberBandSettings()"
      />

      <!-- Map click listener -->
      <YandexMapListener :settings="listenerSettings" />
    </YandexMap>

    <!-- Draw button -->
    <button
      class="map-draw-btn"
      :class="{ cancel: drawing }"
      @click="drawing ? onCancelDraw() : emit('start-draw')"
    >
      {{ drawing ? 'Отменить' : '+ Нарисовать зону' }}
    </button>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, shallowRef, onMounted, onBeforeUnmount, inject, nextTick, toRef, type Ref } from 'vue'
import {
  YandexMap,
  YandexMapDefaultSchemeLayer,
  YandexMapDefaultFeaturesLayer,
  YandexMapFeature,
  YandexMapListener,
  YandexMapMarker,
  YandexMapControls,
  YandexMapZoomControl,
  YandexMapControlButton,
} from 'vue-yandex-maps'
import type { YandexMapListenerSettings } from 'vue-yandex-maps'
import { UiIcon } from '@fastio/ui'
import type { DeliveryZone, Branch } from '@fastio/shared'
import { usePolygonDraw } from '~/composables/delivery/usePolygonDraw'

type Props = {
  zones: DeliveryZone[]
  branches?: Branch[]
  selectedZoneId?: string
  selectedBranchId?: string
  drawing: boolean
  drawingBranchId?: string
}

type Emits = {
  'zone-click': [zoneId: string]
  'polygon-drawn': [coordinates: [number, number][]]
  'cancel-draw': []
  'start-draw': []
  'update:fullscreen': [value: boolean]
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const isDark = inject<Ref<boolean>>('isDark', ref(false))

const mapRoot = ref<HTMLElement | null>(null)
const isFullscreen = ref(false)
const mapKey = ref(0)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapInstance = shallowRef<any>(null)

const {
  drawPoints, cursorCoords, nearFirstPoint,
  isNearFirstPoint, addPoint, finishDraw, cancelDraw,
  getDrawLinesSettings, getDrawFillSettings,
  getRubberBandSettings, getClosingRubberBandSettings,
} = usePolygonDraw(toRef(props, 'drawing'), mapInstance)

// Default center — Moscow
const MOSCOW: [number, number] = [37.617617, 55.755864]
const mapSettings = ref({
  location: { center: MOSCOW, zoom: 10 },
})

const branchesWithCoords = computed(() => (props.branches ?? []).filter((b) => b.latitude != null && b.longitude != null),
)

// Collect all points (branch coords + zone polygon vertices) for bounds calculation
const allPoints = computed((): [number, number][] => {
  const points: [number, number][] = []

  for (const b of branchesWithCoords.value) {
    points.push([b.longitude!, b.latitude!])
  }

  for (const z of props.zones) {
    for (const coord of z.coordinates) {
      points.push(coord)
    }
  }

  return points
})

const fitBounds = () => {
  const pts = allPoints.value

  if (pts.length === 0) return

  let minLng = Infinity
  let maxLng = -Infinity
  let minLat = Infinity
  let maxLat = -Infinity

  for (const [lng, lat] of pts) {
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }

  // Add padding
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

// Auto-fit when zones/branches change OR when map instance becomes available
watch(allPoints, () => fitBounds(), { flush: 'post' })
watch(mapInstance, () => fitBounds())

const getZoneFeatureSettings = (zone: DeliveryZone) => {
  const isSelected = zone.id === props.selectedZoneId
  const color = zone.color

  const hasBranchFilter = !!props.selectedBranchId
  const belongsToSelectedBranch = zone.branchId === props.selectedBranchId
  const dimmed = hasBranchFilter && !belongsToSelectedBranch

  const fillOpacity = isSelected ? '55' : dimmed ? '15' : '33'
  const strokeWidth = isSelected ? 3 : dimmed ? 1 : 2
  const strokeOpacity = dimmed ? '88' : ''

  return {
    id: zone.id,
    geometry: {
      type: 'Polygon' as const,
      coordinates: [zone.coordinates],
    },
    style: {
      stroke: [{ color: color + strokeOpacity, width: strokeWidth }],
      fill: color + fillOpacity,
    },
    onClick: () => emit('zone-click', zone.id),
  }
}

const listenerSettings = computed((): YandexMapListenerSettings => ({
  onClick: (_obj, event) => {
    if (!props.drawing) return

    const coords: [number, number] = event.coordinates as [number, number]

    // Auto-close: if clicking near the first point and have enough points
    if (isNearFirstPoint(coords)) {
      const polygon = finishDraw()

      if (polygon) emit('polygon-drawn', polygon)

      return
    }

    addPoint(coords)
  },
  onMouseMove: (_obj, event) => {
    if (!props.drawing) return
    cursorCoords.value = event.coordinates as [number, number]
  },
}))

const onCancelDraw = () => {
  cancelDraw()
  emit('cancel-draw')
}

// Fullscreen
const setFullscreen = (val: boolean) => {
  isFullscreen.value = val
  emit('update:fullscreen', val)
  nextTick(() => mapKey.value++)
}

const toggleFullscreen = () => setFullscreen(!isFullscreen.value)

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && isFullscreen.value) {
    setFullscreen(false)
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<style scoped lang="scss">
.map-root {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 400px;
}

.map-draw-btn {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 10;
  padding: 8px 16px;
  border-radius: 8px;
  border: 1.5px dashed #ccc;
  background: #fff;
  color: #333;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  transition: border-color 0.15s, background 0.15s;

  &:hover {
    border-color: #ff5500;
    background: #f5f5f5;
  }

  &.cancel {
    border-style: solid;
    border-color: #e0e0e0;
    color: #d32f2f;

    &:hover {
      border-color: #d32f2f;
      background: #fef2f2;
    }
  }
}

.branch-marker {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: default;
  // сдвигаем так, чтобы центр точки (5px) совпадал с координатой
  transform: translate(-50%, -5px);

  &.selected .branch-marker-pill {
    border-color: var(--branch-color, #ff5500);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
  }
}

.branch-marker-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--branch-color, #ff5500);
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  flex-shrink: 0;
}

.branch-marker-pill {
  margin-top: 4px;
  display: flex;
  align-items: center;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 16px;
  padding: 3px 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  white-space: nowrap;
}

.branch-marker-label {
  font-size: 12px;
  font-weight: 500;
  color: #333;
}

.draw-point {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #FF5500;
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  transform: translate(-50%, -50%);
  transition: transform 0.15s, box-shadow 0.15s;

  &.first {
    width: 13px;
    height: 13px;
    background: #fff;
    border-color: #FF5500;
    border-width: 3px;
  }

  &.snap {
    transform: translate(-50%, -50%) scale(1.5);
    box-shadow: 0 0 0 6px rgba(255, 85, 0, 0.25), 0 1px 4px rgba(0, 0, 0, 0.3);
  }
}

</style>
