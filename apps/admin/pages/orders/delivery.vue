<template>
  <div class="zones-root">
    <template v-if="deliveryEnabled">
      <AppStorefrontAlert feature-key="delivery" />
      <div class="mode-switch">
        <UiSegmentedControl
          :model-value="deliveryMode"
          :items="modeItems"
          @update:model-value="switchMode"
        />
      </div>

      <SettingsDelivery v-if="deliveryMode === 'fixed'" :tenant="tenantStore.tenant" />

      <!-- Top bar: hint + zone tiles -->
      <div v-if="deliveryMode === 'zones'" class="zones-topbar">
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

        <div data-tour="delivery-zone-tiles" class="zones-tiles">
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

        <UiAlert v-if="!zonesLoading && zones.length === 0" type="error" icon="warningRound">
          Создайте хотя бы одну зону, иначе доставка будет недоступна для клиентов
        </UiAlert>
      </div>

      <!-- Map + optional form sidebar -->
      <div v-if="deliveryMode === 'zones'" class="zones-body" :class="{ fullscreen: mapFullscreen }">
        <div class="zones-map">
          <DeliveryZoneMap
            :zones="activeZones"
            :branches="activeBranches"
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
import { ref, computed, defineAsyncComponent } from 'vue'
import { storeToRefs } from 'pinia'
import { UiSkeleton, UiAlert, UiSegmentedControl, useMessage } from '@fastio/ui'
import { useConfirm } from '@fastio/kit'
import type { DeliveryMode } from '@fastio/shared'
import { useTenantStore } from '~/shared/stores/tenant'
import { useBranchStore } from '~/shared/stores/branch'
import { useDeliveryZoneStore } from '~/features/orders'
import { useZoneEditor, type ZoneForm } from '~/shared/composables/delivery/useZoneEditor'
import { useGate } from '~/shared/plan/useGate'
import AppStorefrontAlert from '~/shared/ui/components/AppStorefrontAlert.vue'
import DeliveryZonePanel from '~/features/settings/components/DeliveryZonePanel.vue'
import SettingsDelivery from '~/features/settings/components/SettingsDelivery.vue'

// DeliveryZoneMap тащит vue-yandex-maps (~массивный chunk). Лениво грузим,
// чтобы карта попала в отдельный route-chunk и не в main entry.
const DeliveryZoneMap = defineAsyncComponent(
  () => import('~/features/settings/components/DeliveryZoneMap.vue'),
)

const tenantStore = useTenantStore()
const branchStore = useBranchStore()
const deliveryZoneStore = useDeliveryZoneStore()
const { zones, loading: zonesLoading } = storeToRefs(deliveryZoneStore)
const { add: addZone, update: updateZone, remove: removeZone } = deliveryZoneStore
const gate = useGate()

const deliveryEnabled = computed(() => gate.delivery.value.enabled)

const modeItems = [
  { label: 'Фикс. стоимость', value: 'fixed' },
  { label: 'Зоны доставки', value: 'zones' },
]

const { confirm } = useConfirm()
const { success } = useMessage()
const deliveryMode = computed(() => tenantStore.tenant.deliveryMode ?? 'zones')

const confirmMessages: Record<string, { title: string; message: string }> = {
  fixed: {
    title: 'Переключить на фиксированную стоимость?',
    message: 'Стоимость доставки будет одинаковой для всех адресов. Зоны доставки перестанут использоваться.',
  },
  zones: {
    title: 'Переключить на зоны доставки?',
    message: 'Стоимость будет рассчитываться по зонам. Если зон нет — доставка станет недоступна для клиентов.',
  },
}

async function switchMode(mode: string | number) {
  const target = String(mode)

  if (target === deliveryMode.value) return

  const msg = confirmMessages[target]
  const ok = await confirm({
    title: msg.title,
    message: msg.message,
    confirmText: 'Переключить',
    confirmType: 'warning',
  })

  if (!ok) return

  await tenantStore.update({ deliveryMode: target as DeliveryMode })
  const label = modeItems.find((i) => i.value === target)?.label ?? target

  success(`Режим доставки: ${label}`)
}

const branches = computed(() => branchStore.branches)
const activeBranches = computed(() => branches.value.filter((b) => b.isActive))

const branchOptions = computed(() => activeBranches.value.map((b) => ({
  label: b.name,
  value: b.id,
})))

const activeBranchIds = computed(() => new Set(activeBranches.value.map((b) => b.id)))
const activeZones = computed(() => zones.value.filter((z) => activeBranchIds.value.has(z.branchId)))

const {
  selectedZoneId, selectedBranchId, drawing, drawingBranchId,
  zoneForm, panelVisible,
  selectZone, onZoneClick, startDraw, onPolygonDrawn, closePanel,
} = useZoneEditor(activeZones, activeBranches)

const zoneSaving = ref(false)
const zoneRemoving = ref(false)
const mapFullscreen = ref(false)

const groupedZones = computed(() => [...activeBranches.value]
  .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  .map((branch) => ({
    branch,
    zones: activeZones.value.filter((z) => z.branchId === branch.id),
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

  const zoneName = zoneForm.value?.name
  const ok = await confirm({
    title: 'Удалить зону?',
    message: zoneName ? `Зона «${zoneName}» будет удалена без возможности восстановления.` : 'Зона будет удалена без возможности восстановления.',
    confirmText: 'Удалить',
    confirmType: 'error',
  })

  if (!ok) return

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
@use '@fastio/styles/mixins/layout' as *;

.zones-root {
  display: flex;
  flex-direction: column;
}

.mode-switch {
  padding: var(--space-16) 0 0;
}

// Top bar
.zones-topbar {
  @include flex-col(var(--space-12));
  padding: var(--space-16) 0;
  border-bottom: 1px solid var(--color-border-light);
  flex-shrink: 0;
}

.zones-tiles {
  display: flex;
  gap: var(--space-8);
  flex-wrap: wrap;
}

.branch-card {
  @include flex-row;
  padding: var(--space-8) var(--space-12);
  border: 1.5px dashed var(--color-border);
  border-radius: var(--radius-8);

  &.empty {
    border-color: var(--color-error);
  }
}

.branch-label {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.branch-zones {
  @include flex-row;
}

.zone-tile {
  @include flex-row;
  padding: var(--space-4) var(--space-8);
  border-radius: var(--radius-8);
  border: 1.5px solid transparent;
  background: none;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  white-space: nowrap;

  &:hover {
    background: var(--color-bg-hover);
  }

  &.active {
    border-color: var(--color-primary);
    background: var(--color-primary-light);
  }
}

.zone-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.no-zones {
  font-size: var(--font-size-base);
  color: var(--color-text-hint);
  font-style: italic;
}

.zone-tile-name {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
  /* stylelint-disable-next-line scale-unlimited/declaration-strict-value */
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
    // Полноэкранный режим карты — поверх контента и sidebar.
    z-index: var(--z-modal);
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
  padding: var(--space-20);
  border-radius: var(--radius-12);
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
