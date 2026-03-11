import { ref } from 'vue'
import useModals from './useModals'

export type ConfirmOptions = {
  title: string
  message?: string
  alert?: string
  confirmDisabled?: boolean
  cancelText?: string | false
  confirmText?: string | false
  cancelType?: 'default' | 'primary' | 'error' | 'warning' | 'success' | 'text'
  confirmType?: 'default' | 'primary' | 'error' | 'warning' | 'success' | 'text'
  closable?: boolean
  stackedActions?: boolean
  reverseActions?: boolean
  width?: number
}

const DEFAULT_OPTIONS: Partial<ConfirmOptions> = {
  cancelText: 'Отменить',
  confirmText: 'Подтвердить',
  cancelType: 'default',
  confirmType: 'primary',
  width: 480,
}

const currentOptions = ref<ConfirmOptions>({ title: '' })

const useConfirm = () => {
  const { open } = useModals()

  const confirm = async (options: ConfirmOptions): Promise<boolean> => {
    currentOptions.value = { ...DEFAULT_OPTIONS, ...options }
    return open('__confirm__')
  }

  return { confirm }
}

export const confirmState = { currentOptions }

export default useConfirm
