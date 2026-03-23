import { ref, computed } from 'vue'

type ConfirmOptions = {
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type ConfirmItem = {
  message: string
  title: string
  confirmLabel: string
  cancelLabel: string
  danger: boolean
  resolve: (value: boolean) => void
}

const queue = ref<ConfirmItem[]>([])

const state = computed(() => {
  const item = queue.value[0]
  if (!item) return { open: false, title: '', message: '', confirmLabel: 'Подтвердить', cancelLabel: 'Отмена', danger: false }
  return { open: true, ...item }
})

export function useConfirm() {
  function confirm(message: string, options: ConfirmOptions = {}): Promise<boolean> {
    return new Promise((resolve) => {
      queue.value.push({
        message,
        title: options.title ?? 'Подтвердите действие',
        confirmLabel: options.confirmLabel ?? 'Подтвердить',
        cancelLabel: options.cancelLabel ?? 'Отмена',
        danger: options.danger ?? false,
        resolve,
      })
    })
  }

  function onConfirm() {
    const item = queue.value.shift()
    item?.resolve(true)
  }

  function onCancel() {
    const item = queue.value.shift()
    item?.resolve(false)
  }

  return { confirm, state, onConfirm, onCancel }
}
