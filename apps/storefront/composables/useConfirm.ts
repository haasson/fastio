import { ref, computed } from 'vue'

export type ConfirmSection = {
  title: string
  items: string[]
}

type ConfirmOptions = {
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  sections?: ConfirmSection[]
}

type ConfirmItem = {
  message: string
  title: string
  confirmLabel: string
  cancelLabel: string
  danger: boolean
  sections: ConfirmSection[]
  resolve: (value: boolean) => void
}

const queue = ref<ConfirmItem[]>([])

const state = computed(() => {
  const item = queue.value[0]
  if (!item) return { open: false, title: '', message: '', confirmLabel: 'Подтвердить', cancelLabel: 'Отмена', danger: false, sections: [] as ConfirmSection[] }
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
        sections: options.sections ?? [],
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
