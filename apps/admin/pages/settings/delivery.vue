<template>
  <div class="zones-root">
    <template v-if="deliveryEnabled">
      <!-- Top bar: hint + zone tiles -->
      <div class="zones-topbar">
        <UiAlert v-if="branches.length > 1" type="info" icon="mapPin">
          Задавайте зоны и привязывайте их к филиалам, чтобы заказы из этих зон попадали в выбранные филиалы.
          <br />
          Вы можете задавать как одну зону для филиала, так и несколько, задавая им разные условия доставки
        </UiAlert>
        <UiAlert v-else type="info" icon="mapPin">
          Вы можете задавать различные зоны на карте, и устанавливать для них отдельные условия доставки. Заказы вне зон не будут приниматься
        </UiAlert>

        <UiAlert v-if="hasBranchesWithoutZones" type="warning">
          Не у всех филиалов заданы зоны доставки — заказы в них можно оформить только на самовывоз
        </UiAlert>

        <div class="zones-tiles">
          <UiSkeleton v-if="zonesLoading" text :repeat="2" />

          <div
            v-for="group in groupedZones"
            :key="group.branch.id"
            class="branch-card"
            :class="{ empty: group.zones.length === 0 }"
          >
            <span class="branch-label">{{ group.branch.name }}</span>
            <div class="branch-zones">
              <span v-if="group.zones.length === 0" class="no-zones">нет зон</span>
              <button
                v-for="zone in group.zones"
                :key="zone.id"
                class="zone-tile"
                :class="{ active: selectedZoneId === zone.id }"
                @click="selectZone(zone)"
              >
                <span class="zone-dot" :style="{ background: zone.color }" />
                <span class="zone-tile-name">{{ zone.name }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Map + optional form sidebar -->
      <div class="zones-body" :class="{ fullscreen: mapFullscreen }">
        <div class="zones-map">
          <DeliveryZoneMap
            :zones="zones"
            :branches="branches"
            :selected-zone-id="selectedZoneId"
            :selected-branch-id="selectedBranchId"
            :drawing="drawing"
            :drawing-branch-id="drawingBranchId"
            @zone-click="onZoneClick"
            @polygon-drawn="onPolygonDrawn"
            @cancel-draw="drawing = false"
            @start-draw="startDraw"
            @update:fullscreen="mapFullscreen = $event"
          />
        </div>

        <!-- Zone form sidebar -->
        <Transition name="slide">
          <div v-if="panelVisible" class="zone-panel">
            <DeliveryZonePanel
              :form="(zoneForm as ZoneForm)"
              :zone-id="selectedZoneId"
              :branch-options="branchOptions"
              :existing-zones="zones"
              :saving="zoneSaving"
              :removing="zoneRemoving"
              @save="handleZoneSave"
              @remove="handleZoneRemove"
              @close="closePanel"
            />
          </div>
        </Transition>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { UiSkeleton, UiAlert } from '@fastio/ui'
import { useTenantStore } from '~/stores/tenant'
import { useBranchStore } from '~/stores/branch'
import { useAllDeliveryZones } from '~/composables/delivery/useAllDeliveryZones'
import { useZoneEditor, type ZoneForm } from '~/composables/delivery/useZoneEditor'
import { useModules } from '~/composables/plan/useModules'
import DeliveryZoneMap from '~/components/settings/DeliveryZoneMap.vue'
import DeliveryZonePanel from '~/components/settings/DeliveryZonePanel.vue'

const tenantStore = useTenantStore()
const branchStore = useBranchStore()
const { zones, loading: zonesLoading, add: addZone, update: updateZone, remove: removeZone } = useAllDeliveryZones()
const modules = useModules()

const deliveryEnabled = computed(() => modules.delivery.value.enabled)

const branches = computed(() => branchStore.branches)

const branchOptions = computed(() => branches.value.map((b) => ({
  label: b.name,
  value: b.id,
})))

const {
  selectedZoneId, selectedBranchId, drawing, drawingBranchId,
  zoneForm, panelVisible,
  selectZone, onZoneClick, startDraw, onPolygonDrawn, closePanel,
} = useZoneEditor(zones, branches)

const zoneSaving = ref(false)
const zoneRemoving = ref(false)
const mapFullscreen = ref(false)

const groupedZones = computed(() => [...branches.value]
  .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  .map((branch) => ({
    branch,
    zones: zones.value.filter((z) => z.branchId === branch.id),
  })),
)

const hasBranchesWithoutZones = computed(() => groupedZones.value.some((g) => g.zones.length === 0))

const handleZoneSave = async () => {
  if (!zoneForm.value || !zoneForm.value.branchId) return
  zoneSaving.value = true
  try {
    const data = {
      branchId: zoneForm.value.branchId,
      name: zoneForm.value.name.trim(),
      color: zoneForm.value.color,
      deliveryFee: zoneForm.value.deliveryFee ?? 0,
      minOrder: zoneForm.value.minOrder ?? 0,
      freeDeliveryFrom: zoneForm.value.freeDeliveryFrom ?? 0,
      coordinates: zoneForm.value.coordinates,
      isActive: true,
    }

    if (selectedZoneId.value) {
      await updateZone(selectedZoneId.value, data)
    } else {
      await addZone(data)
    }

    closePanel()
  } finally {
    zoneSaving.value = false
  }
}

const handleZoneRemove = async () => {
  if (!selectedZoneId.value) return
  zoneRemoving.value = true
  try {
    await removeZone(selectedZoneId.value)
    closePanel()
  } finally {
    zoneRemoving.value = false
  }
}
</script>

<style scoped lang="scss">
.zones-root {
  display: flex;
  flex-direction: column;
}

// Top bar
.zones-topbar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid var(--color-border-light);
  flex-shrink: 0;
}

.zones-tiles {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.branch-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border: 1.5px dashed var(--color-border);
  border-radius: 10px;

  &.empty {
    border-color: var(--color-error);
  }
}

.branch-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.branch-zones {
  display: flex;
  align-items: center;
  gap: 6px;
}

.zone-tile {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 8px;
  border: 1.5px solid transparent;
  background: none;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  white-space: nowrap;

  &:hover {
    background: var(--color-surface-hover);
  }

  &.active {
    border-color: var(--color-primary);
    background: var(--color-primary-bg);
  }
}

.zone-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.no-zones {
  font-size: 13px;
  color: var(--color-text-hint);
  font-style: italic;
}

.zone-tile-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
  line-height: 1;
}

// Body: map + form panel
.zones-body {
  height: 70vh;
  min-height: 400px;
  display: flex;
  position: relative;
  overflow: hidden;

  &.fullscreen {
    position: fixed;
    inset: 0;
    z-index: 100;
    height: auto;
  }
}

.zones-map {
  flex: 1;
  overflow: hidden;
}

// Overlay panel on top of map
.zone-panel {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 340px;
  max-height: calc(100% - 32px);
  padding: 20px;
  border-radius: 14px;
  overflow-y: auto;
  background: var(--color-bg-card);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.14), 0 1px 4px rgba(0, 0, 0, 0.08);
  z-index: 10;
}

// Panel transition
.slide-enter-active,
.slide-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
