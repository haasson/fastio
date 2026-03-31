<template>
  <div class="canvas-root">
    <!-- Floating toolbar -->
    <div class="canvas-toolbar">
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
    <div class="canvas-scroll" @click.self="deselectAll">
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
          @click.stop="onTableClick(table)"
        >
          <span class="ct-name">{{ table.name }}</span>
          <span v-if="tableReservations[table.id]" class="ct-reservation">
            {{ tableReservations[table.id] }}
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { UiButton } from '@fastio/ui'
import type { Table, Reservation } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'

type Props = {
  tables: Table[]
  todayReservations: Reservation[]
}

type Emits = {
  update: [table: Table]
  updatePosition: [id: string, x: number | null, y: number | null]
  editTable: [table: Table]
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const api = useDatabase()

// ── Canvas state ──────────────────────────────────────────
const canvasRef = ref<HTMLElement | null>(null)
const selectedId = ref<string | null>(null)
const editing = ref(false)

const placedTables = computed(() => props.tables.filter((t) => t.positionX !== null && t.positionY !== null))
const unplacedTables = computed(() => props.tables.filter((t) => t.positionX === null || t.positionY === null))

// ── Reservations map ─────────────────────────────────────
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

// ── Table style ──────────────────────────────────────────
const tableStyle = (table: Table) => ({
  left: `${table.positionX ?? 0}px`,
  top: `${table.positionY ?? 0}px`,
  width: `${table.tableWidth}px`,
  height: `${table.tableHeight}px`,
  transform: table.rotation ? `rotate(${table.rotation}deg)` : undefined,
})

// ── Selection ────────────────────────────────────────────
const onTableClick = (table: Table) => {
  if (editing.value) {
    selectedId.value = table.id
  } else {
    emit('editTable', table)
  }
}

const deselectAll = () => {
  selectedId.value = null
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
</style>
