<template>
  <div class="canvas-root">
    <!-- Sidebar -->
    <transition name="sidebar-slide">
      <div v-show="sidebarVisible" class="canvas-sidebar">

        <!-- ── Selected table ────────────────────────────── -->
        <template v-if="selectedTable">
          <div class="sidebar-section">
            <UiText size="tiny" class="sidebar-label">Название</UiText>
            <UiInput v-model="editForm.name" size="small" @keyup.enter="saveEdit" />
          </div>

          <div class="sidebar-section">
            <UiText size="tiny" class="sidebar-label">Вместимость</UiText>
            <UiInputNumber
              v-model:value="editForm.capacity"
              :min="1"
              :max="50"
              size="small"
              placeholder="—"
            />
          </div>

          <div class="sidebar-section">
            <UiText size="tiny" class="sidebar-label">Заметка</UiText>
            <UiInput v-model="editForm.notes" size="small" placeholder="Внутренняя заметка..." />
          </div>

          <UiButton type="primary" size="small" @click="saveEdit">Сохранить</UiButton>

          <UiDivider />

          <div v-if="selectedTable.shape === 'rectangle'" class="sidebar-section">
            <UiText size="tiny" class="sidebar-label">Поворот</UiText>
            <div class="rotation-row">
              <UiButton size="small" type="default" @click="rotate(-45)">
                <UiIcon name="chevronLeft" :size="14" />
              </UiButton>
              <span class="rot-value">{{ selectedTable.rotation }}°</span>
              <UiButton size="small" type="default" @click="rotate(45)">
                <UiIcon name="chevronRight" :size="14" />
              </UiButton>
            </div>
          </div>

          <div class="sidebar-section">
            <UiText size="tiny" class="sidebar-label">Цвет</UiText>
            <div class="color-row">
              <button
                v-for="c in COLORS"
                :key="c ?? 'default'"
                class="color-swatch"
                :class="{ 'color-swatch--active': selectedTable.color === c }"
                :style="swatchStyle(c)"
                @click="setColor(c)"
              />
            </div>
          </div>

          <UiDivider />

          <UiButton size="small" type="default" @click="removeFromCanvas(selectedTable)">
            Убрать со схемы
          </UiButton>
          <UiButton
            size="small"
            type="error"
            icon="trash"
            @click="archiveTable(selectedTable)"
          >
            Удалить стол
          </UiButton>
        </template>

        <!-- ── Default: presets + custom ────────────────── -->
        <template v-else>
          <UiText size="tiny" class="sidebar-label">Новый стол</UiText>
          <div class="custom-form">
            <UiText size="tiny" class="form-label">Ширина: {{ customWidth }}px</UiText>
            <input
              v-model.number="customWidth"
              type="range"
              min="60"
              max="300"
              step="10"
              class="slider"
            />

            <UiText size="tiny" class="form-label">Высота: {{ customHeight }}px</UiText>
            <input
              v-model.number="customHeight"
              type="range"
              min="60"
              max="300"
              step="10"
              class="slider"
              :disabled="customShape === 'circle'"
            />

            <UiText size="tiny" class="form-label">Форма</UiText>
            <div class="shape-pick">
              <UiButton size="small" :type="customShape === 'rectangle' ? 'primary' : 'default'" @click="customShape = 'rectangle'">▭</UiButton>
              <UiButton size="small" :type="customShape === 'circle' ? 'primary' : 'default'" @click="setCircle">○</UiButton>
            </div>

            <UiText size="tiny" class="form-label">Цвет</UiText>
            <div class="color-row">
              <button
                v-for="c in COLORS"
                :key="c ?? 'default'"
                class="color-swatch"
                :class="{ 'color-swatch--active': customColor === c }"
                :style="swatchStyle(c)"
                @click="customColor = c"
              />
            </div>

            <UiText size="tiny" class="form-label">Вместимость</UiText>
            <UiInputNumber
              v-model:value="customCapacity"
              :min="1"
              :max="50"
              placeholder="—"
              size="small"
            />

            <UiButton
              type="primary"
              size="small"
              icon="plus"
              @click="createCustom"
            >Добавить стол</UiButton>
          </div>

          <template v-if="unplacedTables.length">
            <UiDivider />
            <UiText size="tiny" class="sidebar-label">Без места</UiText>
            <div class="unplaced-list">
              <button
                v-for="table in unplacedTables"
                :key="table.id"
                class="unplaced-item"
                @click="placeTable(table)"
              >
                <UiIcon name="tableIcon" :size="12" class="unplaced-icon" />
                <UiText size="tiny" class="unplaced-name">{{ table.name }}</UiText>
                <UiIcon name="plus" :size="10" class="unplaced-plus" />
              </button>
            </div>
          </template>
        </template>

      </div>
    </transition>

    <!-- Sidebar toggle -->
    <UiButton
      class="sidebar-toggle"
      type="text"
      size="small"
      :icon="sidebarVisible ? 'chevronLeft' : 'chevronRight'"
      @click="sidebarVisible = !sidebarVisible"
    />

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
            'canvas-table--selected': selectedId === table.id,
            'canvas-table--open': table.isOpen,
            'canvas-table--circle': table.shape === 'circle',
            'canvas-table--colored': !!table.color,
          }"
          :style="tableStyle(table)"
          @pointerdown.stop="onTablePointerDown($event, table)"
          @click.stop="selectTable(table)"
        >
          <div
            class="ct-content"
            :style="table.rotation ? { transform: `rotate(${-table.rotation}deg)` } : undefined"
          >
            <UiIcon name="tableIcon" :size="16" class="ct-icon" />
            <span class="ct-name">{{ table.name }}</span>
            <span v-if="table.capacity" class="ct-cap">{{ table.capacity }} м</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UiButton, UiText, UiIcon, UiInput, UiInputNumber, UiDivider, useMessage } from '@fastio/ui'
import type { Table, TableShape } from '@fastio/shared'
import { useConfirm } from '@fastio/kit'
import { useDatabase } from '~/composables/data/useDatabase'
import { useTenantStore } from '~/stores/tenant'

type Props = {
  tables: Table[]
  globalTags: string[]
}
type Emits = {
  'add': [table: Table]
  'update': [table: Table]
  'delete': [id: string]
  'updatePosition': [id: string, x: number | null, y: number | null]
  'update:globalTags': [tags: string[]]
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const api = useDatabase()
const tenantStore = useTenantStore()
const { success } = useMessage()
const { confirm } = useConfirm()

// ── Colors ────────────────────────────────────────────────
const COLORS: (string | null)[] = [
  null, '#7C9EBF', '#72A67A', '#C4A84F', '#C47E3A', '#B85C55', '#8E6BAA', '#7B8FA6',
]

const swatchStyle = (c: string | null) => ({
  background: c ?? 'var(--color-bg)',
  border: c ? '2px solid transparent' : '2px solid var(--color-border)',
})

// ── Custom form ───────────────────────────────────────────
const customWidth = ref(120)
const customHeight = ref(80)
const customShape = ref<TableShape>('rectangle')
const customColor = ref<string | null>(null)
const customCapacity = ref<number | null>(null)

const setCircle = () => {
  customShape.value = 'circle'
  customHeight.value = customWidth.value
}

// ── Canvas state ──────────────────────────────────────────
const canvasRef = ref<HTMLElement | null>(null)
const selectedId = ref<string | null>(null)
const sidebarVisible = ref(true)

const placedTables = computed(() => props.tables.filter((t) => t.positionX !== null && t.positionY !== null))
const unplacedTables = computed(() => props.tables.filter((t) => t.positionX === null || t.positionY === null))
const selectedTable = computed(() => props.tables.find((t) => t.id === selectedId.value) ?? null)

// ── Edit form ─────────────────────────────────────────────
const editForm = ref({ name: '', capacity: null as number | null, tags: [] as string[], notes: '' })

watch(selectedTable, (table) => {
  if (!table) return
  editForm.value = {
    name: table.name,
    capacity: table.capacity,
    tags: [],
    notes: table.notes ?? '',
  }
})

const saveEdit = async () => {
  const table = selectedTable.value

  if (!table) return
  const updated = await api.tables.updateMeta(table.id, {
    name: editForm.value.name.trim() || table.name,
    capacity: editForm.value.capacity,
    tags: editForm.value.tags,
    notes: editForm.value.notes.trim() || null,
  })

  if (updated) {
    emit('update', updated)
    success('Сохранено')
  }
}

// ── Table style ───────────────────────────────────────────
const tableStyle = (table: Table) => ({
  left: `${table.positionX ?? 0}px`,
  top: `${table.positionY ?? 0}px`,
  width: `${table.tableWidth}px`,
  height: `${table.tableHeight}px`,
  transform: table.rotation ? `rotate(${table.rotation}deg)` : undefined,
  backgroundColor: table.color
    ? `color-mix(in srgb, ${table.color} 25%, var(--color-bg-card))`
    : undefined,
  borderColor:
    table.color && !table.isOpen && selectedId.value !== table.id ? table.color : undefined,
})

// ── Drag ──────────────────────────────────────────────────
type DragState = { tableId: string; startPx: number; startPy: number; startCx: number; startCy: number }
const dragging = ref<DragState | null>(null)

const selectTable = (table: Table) => {
  selectedId.value = table.id
}
const deselectAll = () => {
  selectedId.value = null
}

const onTablePointerDown = (e: PointerEvent, table: Table) => {
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

const onCanvasPointerMove = (e: PointerEvent) => {
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

const onCanvasPointerUp = async () => {
  if (!dragging.value) return
  const { tableId } = dragging.value

  dragging.value = null
  const table = props.tables.find((t) => t.id === tableId)

  if (table?.positionX != null && table.positionY != null) {
    await api.tables.updatePosition(tableId, table.positionX, table.positionY)
    emit('updatePosition', tableId, table.positionX, table.positionY)
  }
}

// ── Rotation ──────────────────────────────────────────────
const rotate = async (delta: number) => {
  const table = selectedTable.value

  if (!table) return
  const newRot = ((table.rotation + delta) % 360 + 360) % 360

  table.rotation = newRot
  await api.tables.updateMeta(table.id, { rotation: newRot })
}

// ── Color ─────────────────────────────────────────────────
const setColor = async (color: string | null) => {
  const table = selectedTable.value

  if (!table) return
  table.color = color
  await api.tables.updateMeta(table.id, { color })
}

// ── Remove / Place ────────────────────────────────────────
const removeFromCanvas = async (table: Table) => {
  table.positionX = null
  table.positionY = null
  selectedId.value = null
  await api.tables.updatePosition(table.id, null, null)
  emit('updatePosition', table.id, null, null)
}

const placeTable = (table: Table) => {
  const x = 100 + Math.random() * 200
  const y = 100 + Math.random() * 200

  table.positionX = x
  table.positionY = y
  api.tables.updatePosition(table.id, x, y)
  emit('updatePosition', table.id, x, y)
}

// ── Archive ───────────────────────────────────────────────
const archiveTable = async (table: Table) => {
  const ok = await confirm({
    title: 'Удалить стол?',
    message: `«${table.name}» будет деактивирован. История заказов сохранится.`,
    confirmText: 'Удалить',
    confirmType: 'error',
  })

  if (!ok) return
  await api.tables.archive(table.id)
  selectedId.value = null
  emit('delete', table.id)
  success('Стол удалён')
}

// ── Create ────────────────────────────────────────────────
const createCustom = async () => {
  const tenantId = tenantStore.currentTenantId

  if (!tenantId) return
  const n = props.tables.length + 1
  const h = customShape.value === 'circle' ? customWidth.value : customHeight.value
  const created = await api.tables.add(tenantId, {
    name: `Стол ${n}`,
    capacity: customCapacity.value,
    shape: customShape.value,
    tableWidth: customWidth.value,
    tableHeight: h,
    color: customColor.value,
    positionX: 80 + Math.random() * 300,
    positionY: 80 + Math.random() * 200,
  })

  if (created) emit('add', created)
}
</script>

<style scoped lang="scss">
.canvas-root {
  display: flex;
  height: calc(100vh - 60px - 48px - 40px - 24px);
  min-height: 500px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-bg-subtle);
}

// ── Sidebar ──────────────────────────────────────────────
.canvas-sidebar {
  width: 240px;
  flex-shrink: 0;
  border-right: 1px solid var(--color-border);
  background: var(--color-bg-card);
  padding: 12px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sidebar-section {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.sidebar-label {
  color: var(--color-text-hint);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

// ── Sidebar transition ────────────────────────────────────
.sidebar-slide-enter-active,
.sidebar-slide-leave-active {
  transition: width 0.2s ease, opacity 0.15s ease, padding 0.2s ease;
  overflow: hidden;
}
.sidebar-slide-enter-from,
.sidebar-slide-leave-to {
  width: 0 !important;
  opacity: 0;
  padding: 0 !important;
}

// ── Sidebar toggle ────────────────────────────────────────
.sidebar-toggle {
  flex-shrink: 0;
  width: 20px;
  border-radius: 0;
  border-right: 1px solid var(--color-border);
  color: var(--color-text-hint);

  &:hover { color: var(--color-text); background: var(--color-bg-subtle); }
}

// ── Rotation ─────────────────────────────────────────────
.rotation-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.rot-value {
  flex: 1;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}

// ── Colors ────────────────────────────────────────────────
.color-row {
  display: flex;
  flex-wrap: nowrap;
  gap: 4px;
}

.color-swatch {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  cursor: pointer;
  padding: 0;
  transition: transform 0.1s, outline 0.1s;
  outline: 2px solid transparent;
  outline-offset: 2px;

  &:hover { transform: scale(1.15); }
  &--active { outline-color: var(--color-primary); }
}

// ── Tags ──────────────────────────────────────────────────
.tag-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-height: 20px;
}

.tag-available {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag-new-row {
  display: flex;
  gap: 4px;
  align-items: center;
}

// ── Custom form ──────────────────────────────────────────
.custom-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label { color: var(--color-text-hint); }

.slider {
  width: 100%;
  accent-color: var(--color-primary);
  cursor: pointer;
  height: 4px;
}

.shape-pick {
  display: flex;
  gap: 4px;
  > * { flex: 1; }
}

// ── Unplaced ─────────────────────────────────────────────
.unplaced-list { display: flex; flex-direction: column; gap: 3px; }

.unplaced-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 7px;
  border-radius: 6px;
  border: 1px dashed var(--color-border);
  background: none;
  cursor: pointer;
  color: inherit;
  width: 100%;
  transition: background 0.15s, border-color 0.15s;

  &:hover { background: var(--color-bg-subtle); border-color: var(--color-primary); }
}

.unplaced-icon { color: var(--color-text-hint); flex-shrink: 0; }
.unplaced-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.unplaced-plus { color: var(--color-primary); flex-shrink: 0; }

// ── Canvas ───────────────────────────────────────────────
.canvas-scroll {
  flex: 1;
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
  cursor: grab;
  user-select: none;
  transform-origin: center center;
  transition: border-color 0.15s, box-shadow 0.15s;
  box-shadow: 0 2px 6px color-mix(in srgb, #000 8%, transparent);

  &:active { cursor: grabbing; }
  &--circle { border-radius: 50%; }

  &--selected {
    border-color: var(--color-primary) !important;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 25%, transparent);
  }

  &--open:not(&--selected) {
    border-color: var(--color-success);
    background: color-mix(in srgb, var(--color-success) 10%, var(--color-bg-card));
  }
}

.ct-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  max-width: 90%;
  pointer-events: none;
}

.ct-icon {
  color: var(--color-primary);
  opacity: 0.7;
  .canvas-table--open & { color: var(--color-success); }
  .canvas-table--colored & { color: var(--color-text-secondary); }
}

.ct-name {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
  line-height: 1.2;
}

.ct-cap {
  font-size: 9px;
  color: var(--color-text-hint);
}
</style>
