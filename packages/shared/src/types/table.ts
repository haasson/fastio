export type TableShape = 'rectangle' | 'circle'

export type TableCallType = {
  id: string
  tenantId: string
  name: string
  sortOrder: number
  createdAt: string
}

export type TableCall = {
  id: string
  tenantId: string
  tableId: string
  callTypeId: string | null
  callTypeName: string
  createdAt: string
  resolvedAt: string | null
}

export type Table = {
  id: string
  tenantId: string
  branchId: string
  name: string
  isOpen: boolean
  isActive: boolean
  openedAt: string | null
  createdAt: string
  capacity: number | null
  tags: string[]
  positionX: number | null
  positionY: number | null
  shape: TableShape
  tableWidth: number
  tableHeight: number
  rotation: number
  color: string | null
  notes: string | null
}

// Размер карточек: 's' (компактные) / 'm' / 'l' (крупные). Общий тип для сеток
// карточек столов и заказов — оба используют один пресет ширины (TILE_SIZE_MIN).
export type TileSize = 's' | 'm' | 'l'

// Псевдоним сохраняем для обратной совместимости — используется в table_settings.
export type CanvasTileSize = TileSize

export type TableSettings = {
  tenantId: string
  callButtonLabel: string
  callButtonIcon: string | null
  callCooldownSeconds: number
  callEscalationMinutes: number
  canvasTileSize: CanvasTileSize
  showDishCategory: boolean
}

export type TableSettingsFormData = {
  callButtonLabel: string
  callButtonIcon?: string | null
  callCooldownSeconds: number
  callEscalationMinutes: number
  canvasTileSize: CanvasTileSize
  showDishCategory: boolean
}

export type TableFormData = {
  name: string
  branchId?: string | null
  capacity?: number | null
  tags?: string[]
  notes?: string | null
  shape?: TableShape
  tableWidth?: number
  tableHeight?: number
  positionX?: number | null
  positionY?: number | null
  rotation?: number
  color?: string | null
}
