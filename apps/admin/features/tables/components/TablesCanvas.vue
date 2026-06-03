<template>
  <div class="canvas-root">
    <!-- Floating toolbar -->
    <div v-if="canManageTables" class="canvas-toolbar">
      <UiButton
        :type="editing ? 'primary' : 'default'"
        size="small"
        icon="pencil"
        @click="editing = !editing"
      >
        {{ editing ? 'Готово' : 'Редактировать' }}
      </UiButton>
      <template v-if="editing && unplacedTables.length">
        <span class="toolbar-divider" />
        <span class="toolbar-hint">Без места:</span>
        <button
          v-for="table in unplacedTables"
          :key="table.id"
          class="unplaced-chip"
          @click="placeTable(table)"
        >
          {{ table.name }}
        </button>
      </template>
    </div>

    <!-- Canvas -->
    <div ref="scrollRef" class="canvas-scroll" @click.self="deselectAll">
      <div
        ref="canvasRef"
        class="canvas"
        @pointermove="onCanvasPointerMove"
        @pointerup="onCanvasPointerUp"
        @click.self="deselectAll"
      >
        <div
          v-for="table in placedTables"
          :key="table.id"
          class="canvas-table"
          :class="{
            'canvas-table--selected': editing && selectedId === table.id,
            'canvas-table--open': table.isOpen,
            'canvas-table--reserved': !!tableReservations[table.id],
            'canvas-table--circle': table.shape === 'circle',
            'canvas-table--editing': editing,
          }"
          :style="tableStyle(table)"
          @pointerdown.stop="onTablePointerDown($event, table)"
          @click.stop="onTableClick($event, table)"
        >
          <span class="ct-name">{{ table.name }}</span>
          <span v-if="tableReservations[table.id]" class="ct-reservation">
            {{ tableReservations[table.id] }}
          </span>

          <!-- Бейдж вызова: тап → resolve (один) / поповер (несколько) -->
          <button
            v-if="tableCalls(table).length"
            type="button"
            class="ct-badge ct-badge--call"
            :class="{ 'ct-badge--escalated': isTableEscalated(table) }"
            :style="badgeStyle(table)"
            :aria-label="`Вызовов: ${tableCalls(table).length}`"
            @pointerdown.stop
            @click.stop="onCallBadgeClick($event, table)"
          >
            <UiIcon :name="isTableEscalated(table) ? 'bellRing' : 'messageCircle'" :size="12" />
            <span v-if="tableCalls(table).length > 1" class="ct-badge-count">{{ tableCalls(table).length }}</span>
          </button>

          <!-- Кухонный бейдж: оранжевый счётчик новых позиций + зелёный счётчик готовых блюд -->
          <span
            v-if="tablePendingCount(table) || tableReadyCount(table)"
            class="ct-kitchen"
            :style="badgeStyle(table)"
          >
            <span v-if="tablePendingCount(table)" class="ct-badge ct-badge--pending">
              <span class="ct-badge-dot" />{{ tablePendingCount(table) }}
            </span>
            <span v-if="tableReadyCount(table)" class="ct-badge ct-badge--ready">
              <span class="ct-badge-dot" />{{ tableReadyCount(table) }}
            </span>
          </span>

          <!-- Resize handles: visible on all tables in edit mode -->
          <template v-if="editing">
            <div
              v-for="h in resizeHandles"
              :key="h"
              class="resize-handle"
              :class="[`resize-handle--${h}`, { 'resize-handle--active': selectedId === table.id }]"
              :style="{ cursor: getResizeCursor(h, table.rotation) }"
              @pointerdown.stop="onResizePointerDown($event, table, h)"
            />

            <!-- Rotate handle: only on selected table -->
            <template v-if="selectedId === table.id">
              <div class="rotate-stem" />
              <div
                class="rotate-handle"
                @pointerdown.stop="onRotatePointerDown($event, table)"
              />
            </template>
          </template>
        </div>
      </div>
    </div>
    <!-- Context menu for closed tables -->
    <UiPopover
      trigger="manual"
      placement="bottom-start"
      :show="!!contextMenu"
      :x="contextMenu?.x"
      :y="contextMenu?.y"
      :show-arrow="false"
      no-sheet
      @clickoutside="contextMenu = null"
    >
      <template #trigger>
        <span />
      </template>
      <UiMenuDropdown
        :items="contextMenuItems"
        inline
        compact
        @item-click="onContextMenuClick"
      />
    </UiPopover>

    <!-- Выбор вызова для закрытия (если на столе >1 вызова) -->
    <UiPopover
      trigger="manual"
      placement="bottom-start"
      :show="!!callPopover && popoverCalls.length > 0"
      :x="callPopover?.x"
      :y="callPopover?.y"
      :show-arrow="false"
      no-sheet
      @clickoutside="callPopover = null"
    >
      <template #trigger>
        <span />
      </template>
      <div class="call-popover">
        <div v-for="call in popoverCalls" :key="call.id" class="call-popover-row">
          <UiIcon name="messageCircle" :size="14" class="call-popover-icon" />
          <UiText size="small" class="call-popover-name">{{ call.callTypeName }}</UiText>
          <UiText size="tiny" class="call-popover-time">{{ formatRelativeTime(call.createdAt, now) }}</UiText>
          <UiButton
            size="small"
            type="success"
            circle
            icon="check"
            aria-label="Закрыть вызов"
            @click="resolveFromPopover(call.id)"
          />
        </div>
      </div>
    </UiPopover>

    <!-- Панель внимания: вызовы / готовые блюда + панорама к ближайшему -->
    <div v-if="totalCalls > 0 || totalReady > 0" class="attention-panel">
      <button
        v-if="totalCalls > 0"
        type="button"
        class="attention-chip attention-chip--call"
        :class="{ 'attention-chip--escalated': placedWithCalls.some(isTableEscalated) }"
        @click="panNextCall"
      >
        <UiIcon name="bellRing" :size="14" />
        {{ totalCalls }}
      </button>
      <button
        v-if="totalReady > 0"
        type="button"
        class="attention-chip attention-chip--ready"
        @click="panNextReady"
      >
        <span class="attention-dot" />
        {{ totalReady }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useNow } from '@vueuse/core'
import { UiButton, UiMenuDropdown, UiPopover, UiIcon, UiText } from '@fastio/ui'
import type { UiMenuDropdownItem } from '@fastio/ui'
import type { Table, Reservation, TableCall, KitchenQueueItem } from '@fastio/shared'
import { formatRelativeTime } from '@fastio/shared'
import { useDatabase } from '~/shared/data/useDatabase'
import { useGate } from '~/shared/plan/useGate'

type Props = {
  tables: Table[]
  todayReservations: Reservation[]
  callsByTable: Record<string, TableCall[]>
  readyDishes: Record<string, KitchenQueueItem[]>
  pendingByTable: Record<string, number>
  escalationMinutes: number
}

type Emits = {
  update: [table: Table]
  updatePosition: [id: string, x: number | null, y: number | null]
  openDetail: [table: Table]
  openTable: [table: Table]
  bookTable: [table: Table]
  openReservation: [id: string]
  resolveCall: [id: string]
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const api = useDatabase()
const gate = useGate()
const canManageTables = computed(() => gate.manageTables.value.enabled)

const now = useNow({ interval: 30_000 })

// ── Canvas state ──────────────────────────────────────────
const canvasRef = ref<HTMLElement | null>(null)
const scrollRef = ref<HTMLElement | null>(null)
const selectedId = ref<string | null>(null)
const editing = ref(false)

const placedTables = computed(() => props.tables.filter((t) => t.positionX !== null && t.positionY !== null))
const unplacedTables = computed(() => props.tables.filter((t) => t.positionX === null || t.positionY === null))

// ── Reservations map (earliest time per table) ──────────
const tableReservations = computed(() => {
  const map: Record<string, string> = {}

  for (const r of props.todayReservations) {
    if (!r.tableId) continue
    if (!map[r.tableId] || r.reservedTime < map[r.tableId]) {
      map[r.tableId] = r.reservedTime
    }
  }

  return map
})

// ── Calls / ready badges ─────────────────────────────────
const tableCalls = (table: Table) => props.callsByTable[table.id] ?? []
const tableReadyCount = (table: Table) => (props.readyDishes[table.id] ?? []).length
const tablePendingCount = (table: Table) => props.pendingByTable[table.id] ?? 0
// Контр-вращение: бейдж остаётся вертикальным на повёрнутых плитках.
const badgeStyle = (table: Table) => (table.rotation ? { transform: `rotate(${-table.rotation}deg)` } : undefined)
const isTableEscalated = (table: Table) => tableCalls(table)
  .some((c) => now.value.getTime() - new Date(c.createdAt).getTime() >= props.escalationMinutes * 60_000)

// Поповер выбора вызова при >1 активном вызове на столе.
const callPopover = ref<{ table: Table; x: number; y: number } | null>(null)
const popoverCalls = computed(() => callPopover.value ? tableCalls(callPopover.value.table) : [])

const onCallBadgeClick = (event: MouseEvent, table: Table) => {
  const calls = tableCalls(table)

  if (!calls.length) return
  if (calls.length === 1) {
    emit('resolveCall', calls[0].id)

    return
  }
  callPopover.value = { table, x: event.clientX, y: event.clientY + 4 }
}

const resolveFromPopover = (id: string) => {
  emit('resolveCall', id)
  // Закрываем поповер, если это был последний вызов на столе.
  if (popoverCalls.value.length <= 1) callPopover.value = null
}

// ── Панель внимания (панорама к столам с вызовом/готовностью) ──
const placedWithCalls = computed(() => placedTables.value
  .filter((t) => tableCalls(t).length > 0)
  .sort((a, b) => isTableEscalated(b) === isTableEscalated(a) ? 0 : isTableEscalated(b) ? 1 : -1),
)
const placedWithReady = computed(() => placedTables.value.filter((t) => tableReadyCount(t) > 0))

// Считаем только размещённые столы — панель панорамирует именно к ним,
// иначе счётчик показывал бы вызовы со столов вне схемы (недостижимы кликом).
const totalCalls = computed(() => placedWithCalls.value.reduce((s, t) => s + tableCalls(t).length, 0))
const totalReady = computed(() => placedWithReady.value.reduce((s, t) => s + tableReadyCount(t), 0))

const callPanIndex = ref(0)
const readyPanIndex = ref(0)

const panToTable = (table: Table) => {
  if (!scrollRef.value || table.positionX === null || table.positionY === null) return

  const cx = table.positionX + table.tableWidth / 2
  const cy = table.positionY + table.tableHeight / 2

  scrollRef.value.scrollTo({
    left: cx - scrollRef.value.clientWidth / 2,
    top: cy - scrollRef.value.clientHeight / 2,
    behavior: 'smooth',
  })
}

const panNext = (list: Table[], indexRef: { value: number }) => {
  if (!list.length) return

  const idx = indexRef.value % list.length

  panToTable(list[idx])
  indexRef.value = (idx + 1) % list.length
}

const panNextCall = () => panNext(placedWithCalls.value, callPanIndex)
const panNextReady = () => panNext(placedWithReady.value, readyPanIndex)

// ── Context menu ────────────────────────────────────────
const contextMenu = ref<{ table: Table; x: number; y: number } | null>(null)
const contextMenuItems = computed<UiMenuDropdownItem[]>(() => {
  if (!contextMenu.value) return []

  const table = contextMenu.value.table
  const items: UiMenuDropdownItem[] = [
    { name: 'open', label: 'Открыть стол', icon: 'unlock' },
    { name: 'book', label: 'Забронировать', icon: 'calendar' },
  ]

  // Add today's reservations for this table
  const tableRes = props.todayReservations.filter((r) => r.tableId === table.id)

  if (tableRes.length) {
    items.push({ name: 'divider', isDivider: true })

    for (const r of tableRes) {
      const label = `${r.reservedTime.slice(0, 5)} — ${r.guestName} (${r.guestCount} гостей)`

      items.push({ name: `reservation:${r.id}`, label, icon: 'calendar' })
    }
  }

  return items
})

const onContextMenuClick = (name: string) => {
  if (!contextMenu.value) return
  const table = contextMenu.value.table

  contextMenu.value = null

  if (name === 'open') emit('openTable', table)
  else if (name === 'book') emit('bookTable', table)
  else if (name.startsWith('reservation:')) emit('openReservation', name.replace('reservation:', ''))
}

// ── Table style ──────────────────────────────────────────
const tableStyle = (table: Table) => ({
  left: `${table.positionX ?? 0}px`,
  top: `${table.positionY ?? 0}px`,
  width: `${table.tableWidth}px`,
  height: `${table.tableHeight}px`,
  transform: table.rotation ? `rotate(${table.rotation}deg)` : undefined,
})

// ── Selection ────────────────────────────────────────────
const onTableClick = (event: MouseEvent, table: Table) => {
  if (editing.value) {
    selectedId.value = table.id

    return
  }

  if (table.isOpen) {
    emit('openDetail', table)

    return
  }

  contextMenu.value = { table, x: event.clientX, y: event.clientY + 4 }
}

const deselectAll = () => {
  selectedId.value = null
  contextMenu.value = null
}

// ── Drag ─────────────────────────────────────────────────
type DragState = {
  tableId: string
  startPx: number
  startPy: number
  startCx: number
  startCy: number
}

const dragging = ref<DragState | null>(null)

const onTablePointerDown = (e: PointerEvent, table: Table) => {
  if (!editing.value) return
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  selectedId.value = table.id
  if (!canvasRef.value) return
  const rect = canvasRef.value.getBoundingClientRect()

  dragging.value = {
    tableId: table.id,
    startPx: e.clientX - rect.left,
    startPy: e.clientY - rect.top,
    startCx: (table.positionX ?? 0) + table.tableWidth / 2,
    startCy: (table.positionY ?? 0) + table.tableHeight / 2,
  }
}

// ── Resize ───────────────────────────────────────────────
type ResizeState = {
  tableId: string
  handle: 'nw' | 'ne' | 'sw' | 'se'
  startMouseX: number
  startMouseY: number
  startWidth: number
  startHeight: number
  anchorX: number // world position of the fixed (opposite) corner
  anchorY: number
  rad: number
}

const resizing = ref<ResizeState | null>(null)
const resizeHandles = ['nw', 'ne', 'sw', 'se']
const MIN_SIZE = 60

// Map handle + rotation to correct cursor
const CURSORS = ['nw-resize', 'n-resize', 'ne-resize', 'e-resize', 'se-resize', 's-resize', 'sw-resize', 'w-resize'] as const
const HANDLE_BASE: Record<string, number> = { nw: 0, ne: 2, se: 4, sw: 6 }

const getResizeCursor = (handle: string, rotation: number): string => {
  const base = HANDLE_BASE[handle] ?? 0
  const steps = Math.round(((rotation % 360) + 360) % 360 / 45)

  return CURSORS[(base + steps) % 8]
}

// Opposite corner offset in local coords (relative to center)
const anchorLocal = (handle: string, w: number, h: number) => {
  switch (handle) {
    case 'se': return { x: -w / 2, y: -h / 2 }
    case 'nw': return { x: w / 2, y: h / 2 }
    case 'ne': return { x: -w / 2, y: h / 2 }
    case 'sw': return { x: w / 2, y: -h / 2 }
    default: return { x: 0, y: 0 }
  }
}

const onResizePointerDown = (e: PointerEvent, table: Table, handle: string) => {
  e.stopPropagation()
  selectedId.value = table.id
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)

  const w = table.tableWidth
  const h = table.tableHeight
  const px = table.positionX ?? 0
  const py = table.positionY ?? 0
  const cx = px + w / 2
  const cy = py + h / 2
  const rad = table.rotation * Math.PI / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  // World position of the anchor (opposite) corner
  const a = anchorLocal(handle, w, h)

  resizing.value = {
    tableId: table.id,
    handle: handle as ResizeState['handle'],
    startMouseX: e.clientX,
    startMouseY: e.clientY,
    startWidth: w,
    startHeight: h,
    anchorX: cx + a.x * cos - a.y * sin,
    anchorY: cy + a.x * sin + a.y * cos,
    rad,
  }
}

// ── Rotate ──────────────────────────────────────────────
type RotateState = { tableId: string }

const rotating = ref<RotateState | null>(null)
const ROTATE_STEP = 15

const onRotatePointerDown = (e: PointerEvent, table: Table) => {
  e.stopPropagation()
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  rotating.value = { tableId: table.id }
}

// ── Pointermove (drag + resize + rotate) ────────────────
const onCanvasPointerMove = (e: PointerEvent) => {
  // Resize
  if (resizing.value) {
    const r = resizing.value
    const table = props.tables.find((t) => t.id === r.tableId)

    if (!table) return

    // Mouse delta in local (table-rotated) coordinates
    const rawDx = e.clientX - r.startMouseX
    const rawDy = e.clientY - r.startMouseY
    const cosNeg = Math.cos(-r.rad)
    const sinNeg = Math.sin(-r.rad)
    const dx = rawDx * cosNeg - rawDy * sinNeg
    const dy = rawDx * sinNeg + rawDy * cosNeg

    // Compute new size based on which handle is dragged
    let newW: number
    let newH: number

    switch (r.handle) {
      case 'se':
        newW = r.startWidth + dx
        newH = r.startHeight + dy
        break
      case 'nw':
        newW = r.startWidth - dx
        newH = r.startHeight - dy
        break
      case 'ne':
        newW = r.startWidth + dx
        newH = r.startHeight - dy
        break
      case 'sw':
        newW = r.startWidth - dx
        newH = r.startHeight + dy
        break
    }

    newW = Math.max(newW, MIN_SIZE)
    newH = Math.max(newH, MIN_SIZE)

    if (table.shape === 'circle') {
      const s = Math.max(newW, newH)

      newW = s
      newH = s
    }

    // Recompute center so that the anchor corner stays fixed
    const a = anchorLocal(r.handle, newW, newH)
    const cosR = Math.cos(r.rad)
    const sinR = Math.sin(r.rad)
    const newCx = r.anchorX - (a.x * cosR - a.y * sinR)
    const newCy = r.anchorY - (a.x * sinR + a.y * cosR)

    table.tableWidth = newW
    table.tableHeight = newH
    table.positionX = newCx - newW / 2
    table.positionY = newCy - newH / 2

    return
  }

  // Rotate
  if (rotating.value) {
    const table = props.tables.find((t) => t.id === rotating.value!.tableId)

    if (!table || !canvasRef.value) return

    const rect = canvasRef.value.getBoundingClientRect()
    const cx = (table.positionX ?? 0) + table.tableWidth / 2
    const cy = (table.positionY ?? 0) + table.tableHeight / 2
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const rawAngle = Math.atan2(mx - cx, -(my - cy)) * 180 / Math.PI
    const snapped = Math.round(rawAngle / ROTATE_STEP) * ROTATE_STEP

    table.rotation = ((snapped % 360) + 360) % 360

    return
  }

  // Drag
  if (!dragging.value || !canvasRef.value) return
  const rect = canvasRef.value.getBoundingClientRect()
  const dx = e.clientX - rect.left - dragging.value.startPx
  const dy = e.clientY - rect.top - dragging.value.startPy
  const table = props.tables.find((t) => t.id === dragging.value!.tableId)

  if (table) {
    table.positionX = Math.max(0, dragging.value.startCx + dx - table.tableWidth / 2)
    table.positionY = Math.max(0, dragging.value.startCy + dy - table.tableHeight / 2)
  }
}

// ── Pointerup (save drag + resize + rotate) ─────────────
const onCanvasPointerUp = async () => {
  if (rotating.value) {
    const { tableId } = rotating.value
    const table = props.tables.find((t) => t.id === tableId)

    rotating.value = null

    if (table) {
      await api.tables.updateMeta(tableId, { rotation: table.rotation })
      emit('update', table)
    }

    return
  }

  if (resizing.value) {
    const { tableId } = resizing.value
    const table = props.tables.find((t) => t.id === tableId)

    resizing.value = null

    if (table) {
      await Promise.all([
        api.tables.updateMeta(tableId, {
          tableWidth: table.tableWidth,
          tableHeight: table.tableHeight,
        }),
        api.tables.updatePosition(
          tableId,
          table.positionX ?? 0,
          table.positionY ?? 0,
        ),
      ])
      emit('updatePosition', tableId, table.positionX, table.positionY)
      emit('update', table)
    }

    return
  }

  if (!dragging.value) return
  const { tableId } = dragging.value

  dragging.value = null
  const table = props.tables.find((t) => t.id === tableId)

  if (table?.positionX != null && table.positionY != null) {
    await api.tables.updatePosition(tableId, table.positionX, table.positionY)
    emit('updatePosition', tableId, table.positionX, table.positionY)
  }
}

// ── Place unplaced table ─────────────────────────────────
const placeTable = (table: Table) => {
  const x = 100 + Math.random() * 200
  const y = 100 + Math.random() * 200

  table.positionX = x
  table.positionY = y
  api.tables.updatePosition(table.id, x, y)
  emit('updatePosition', table.id, x, y)
}

</script>

<style scoped lang="scss">
/* Канвас редактора расстановки столов — все размеры (resize/rotate handles,
   смещения -3/-5/-6px, shadow-mix с #000) подобраны под геометрию сцены,
   а не под шкалу дизайн-токенов */
/* stylelint-disable scale-unlimited/declaration-strict-value, color-no-hex */
.canvas-root {
  position: relative;
  height: calc(100vh - 60px - 48px - 40px - 24px);
  min-height: 500px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-bg-subtle);
}

// ── Toolbar ──────────────────────────────────────────────
.canvas-toolbar {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--color-bg-card) 85%, transparent);
  backdrop-filter: blur(8px);
  border: 1px solid var(--color-border);
  box-shadow: 0 2px 8px color-mix(in srgb, #000 6%, transparent);
}

.toolbar-divider {
  width: 1px;
  height: 20px;
  background: var(--color-border);
  flex-shrink: 0;
}

.toolbar-hint {
  font-size: 12px;
  color: var(--color-text-hint);
  white-space: nowrap;
}

.unplaced-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 12px;
  border: 1px dashed var(--color-border);
  background: var(--color-bg-card);
  font-size: 12px;
  color: var(--color-text);
  cursor: pointer;
  white-space: nowrap;
  transition: border-color 0.15s, background 0.15s;

  &:hover {
    border-color: var(--color-primary);
    background: var(--color-bg-subtle);
  }
}

// ── Canvas ───────────────────────────────────────────────
.canvas-scroll {
  width: 100%;
  height: 100%;
  overflow: auto;
  background:
    radial-gradient(circle, var(--color-border) 1px, transparent 1px) 0 0 / 24px 24px,
    var(--color-bg-subtle);
  cursor: default;
}

.canvas {
  position: relative;
  width: 1400px;
  height: 900px;
}

// ── Tables on canvas ─────────────────────────────────────
.canvas-table {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--color-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--color-primary) 6%, var(--color-bg-card));
  user-select: none;
  transform-origin: center center;
  transition: border-color 0.15s, box-shadow 0.15s;
  box-shadow: 0 2px 6px color-mix(in srgb, #000 8%, transparent);
  cursor: default;

  &--editing {
    cursor: grab;

    &:active {
      cursor: grabbing;
    }
  }

  &--circle {
    border-radius: 50%;
  }

  &--selected {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 25%, transparent);
  }

  &--open:not(&--selected) {
    border-color: var(--color-success);
    background: color-mix(in srgb, var(--color-success) 10%, var(--color-bg-card));
  }

  &--reserved:not(&--selected):not(&--open) {
    border-color: var(--color-warning);
    background: color-mix(in srgb, var(--color-warning) 8%, var(--color-bg-card));
  }
}

.ct-name {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text);
  max-width: 90%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
  line-height: 1.2;
  pointer-events: none;
}

.ct-reservation {
  position: absolute;
  top: -6px;
  right: -6px;
  padding: 1px 5px;
  border-radius: 6px;
  font-size: 9px;
  font-weight: 700;
  background: var(--color-warning);
  color: #fff;
  line-height: 1.3;
  pointer-events: none;
}

// ── Resize handles ───────────────────────────────────────
.resize-handle {
  position: absolute;
  width: 6px;
  height: 6px;
  background: color-mix(in srgb, var(--color-primary) 30%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-primary) 40%, transparent);
  border-radius: 50%;
  z-index: 2;
  transition: width 0.15s, height 0.15s, background 0.15s, border-color 0.15s, opacity 0.15s;
  opacity: 0.6;

  &--active {
    width: 10px;
    height: 10px;
    background: var(--color-primary);
    border-color: var(--color-primary);
    border-radius: 3px;
    opacity: 1;
  }

  &--nw {
    top: -3px;
    left: -3px;

    &.resize-handle--active { top: -5px; left: -5px; }
  }

  &--ne {
    top: -3px;
    right: -3px;

    &.resize-handle--active { top: -5px; right: -5px; }
  }

  &--sw {
    bottom: -3px;
    left: -3px;

    &.resize-handle--active { bottom: -5px; left: -5px; }
  }

  &--se {
    bottom: -3px;
    right: -3px;

    &.resize-handle--active { bottom: -5px; right: -5px; }
  }
}

// ── Rotate handle ───────────────────────────────────────
.rotate-stem {
  position: absolute;
  top: -20px;
  left: 50%;
  width: 1px;
  height: 16px;
  background: var(--color-primary);
  opacity: 0.5;
  pointer-events: none;
  transform: translateX(-50%);
}

.rotate-handle {
  position: absolute;
  top: -28px;
  left: 50%;
  width: 12px;
  height: 12px;
  margin-left: -6px;
  border-radius: 50%;
  background: var(--color-primary);
  border: 2px solid var(--color-bg-card);
  cursor: grab;
  z-index: 3;
  transition: transform 0.1s;
  box-shadow: 0 1px 4px color-mix(in srgb, #000 15%, transparent);

  &:hover {
    transform: scale(1.2);
  }

  &:active {
    cursor: grabbing;
  }
}
// ── Tile badges (calls / ready) ─────────────────────────
.ct-badge {
  position: absolute;
  z-index: 4;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 18px;
  min-width: 18px;
  padding: 0 4px;
  border-radius: 9px;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  color: #fff;
  box-shadow: 0 1px 4px color-mix(in srgb, #000 20%, transparent);
}

.ct-badge--call {
  top: -8px;
  left: -8px;
  border: none;
  background: var(--color-warning);
  cursor: pointer;
  transition: transform 0.1s;

  &:hover { transform: scale(1.1); }

  &.ct-badge--escalated {
    background: var(--color-error);
    animation: badge-pulse 1.2s ease-in-out infinite;
  }
}

.ct-badge-count { padding-right: 2px; }

// Кухонный бейдж: группа из счётчиков «новые» (оранжевый) + «готовы» (зелёный)
// в правом нижнем углу плитки, где раньше был одиночный бейдж готовности.
.ct-kitchen {
  position: absolute;
  bottom: -8px;
  right: -8px;
  z-index: 4;
  display: inline-flex;
  gap: 3px;
}

.ct-badge--pending {
  position: static;
  // Оранжевый (бренд), а НЕ --color-warning — иначе сливался бы с жёлтым бейджем вызова.
  background: var(--orange-500);
}

.ct-badge--ready {
  position: static;
  background: var(--color-success);
}

.ct-badge-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #fff;
}

@keyframes badge-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}

// ── Call popover (multi-call resolve) ───────────────────
.call-popover {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 200px;
  padding: 4px;
}

.call-popover-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px;
}

.call-popover-icon { color: var(--color-warning); flex-shrink: 0; }
.call-popover-name { flex: 1; min-width: 0; }
.call-popover-time { color: var(--color-text-hint); flex-shrink: 0; }

// ── Attention panel ─────────────────────────────────────
.attention-panel {
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 10;
  display: flex;
  gap: 8px;
  padding: 6px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--color-bg-card) 88%, transparent);
  backdrop-filter: blur(8px);
  border: 1px solid var(--color-border);
  box-shadow: 0 2px 8px color-mix(in srgb, #000 10%, transparent);
}

.attention-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 999px;
  border: none;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  cursor: pointer;
  transition: transform 0.1s, opacity 0.15s;

  &:hover { transform: translateY(-1px); }
  &:active { opacity: 0.85; }
}

.attention-chip--call {
  background: var(--color-warning);

  &.attention-chip--escalated { background: var(--color-error); }
}

.attention-chip--ready { background: var(--color-success); }

.attention-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #fff;
}
/* stylelint-enable scale-unlimited/declaration-strict-value, color-no-hex */

</style>
