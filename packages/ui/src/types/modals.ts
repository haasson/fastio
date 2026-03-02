import type { Ref } from 'vue'

export type ModalController = {
  isShown: Ref<boolean>
  open: () => Promise<boolean>
  close: () => void
  decline: () => void
  confirm: () => void
}

export type ModalConfig = {
  title?: string
  [key: string]: unknown
}

export type UseModalsReturn = {
  open: (name: string, config?: ModalConfig) => Promise<boolean>
  close: (name: string) => void
  closeAll: () => void
  isOpen: (name: string) => boolean
  getStack: () => readonly string[]
}
