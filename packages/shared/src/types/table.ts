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

export type TableFormData = {
  name: string
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
