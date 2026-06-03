import { useState } from '#app'

type ToastItem = {
  id: string
  title?: string
  description?: string
  variant?: 'default' | 'success' | 'error' | 'warning'
  duration?: number
  // persist: тост не закрывается по таймеру — живёт до ручного dismiss или клика по action.
  persist?: boolean
  // onClick — ТОЛЬКО клиент: тосты живут в useState (сериализуется в SSR-payload),
  // а функции не сериализуются. show() вызываем только на клиенте, так что безопасно.
  action?: { label: string; onClick?: () => void }
  open: boolean
}

export function useToast() {
  const toasts = useState<ToastItem[]>('sf-toasts', () => [])
  const show = (options: Omit<ToastItem, 'id' | 'open'>) => {
    const id = Math.random().toString(36).slice(2)
    toasts.value.push({ ...options, id, open: true })
    // persist-тосты не планируем на авто-закрытие: их снимает пользователь.
    if (options.persist) return
    const duration = options.duration ?? 4000
    setTimeout(() => dismiss(id), duration)
  }

  const dismiss = (id: string) => {
    const toast = toasts.value.find(t => t.id === id)
    // Идемпотентно: клик по action и последующий update:open оба зовут dismiss —
    // если тост уже закрывается (или удалён), второй вызов игнорируем.
    if (!toast || !toast.open) return
    toast.open = false
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id)
    }, 300)
  }

  const success = (title: string, description?: string) =>
    show({ variant: 'success', title, description })

  const error = (title: string, description?: string) =>
    show({ variant: 'error', title, description })

  const warning = (title: string, description?: string) =>
    show({ variant: 'warning', title, description })

  return { toasts, show, dismiss, success, error, warning }
}
