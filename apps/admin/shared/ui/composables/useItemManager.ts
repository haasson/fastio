import { type Ref } from 'vue'
import { useConfirm } from '@fastio/kit'
import useDrawer from '~/composables/ui/useDrawer'
import useDelayedLoading from '~/composables/ui/useDelayedLoading'

type Options = {
  loading: Ref<boolean>
  remove: (id: string) => Promise<void>
  confirmTitle: string
  confirmText?: string
  confirmType?: 'error' | 'warning'
  beforeDelete?: (id: string) => Promise<{ alert?: string; disabled?: boolean } | undefined> | { alert?: string; disabled?: boolean } | undefined
}

export function useItemManager<T extends { id: string }>(options: Options) {
  const { loading, remove, confirmTitle, confirmText = 'Удалить', confirmType = 'error', beforeDelete } = options
  const { confirm } = useConfirm()
  const { showSkeleton } = useDelayedLoading(loading)
  const { isOpen: modalOpen, data: editingItem, open: openModal, close: closeModal } = useDrawer<T>()

  const confirmDelete = async (id: string) => {
    const check = await beforeDelete?.(id)

    const ok = await confirm({
      title: confirmTitle,
      confirmText,
      confirmType,
      alert: check?.alert,
      confirmDisabled: check?.disabled,
    })

    if (ok) await remove(id)
  }

  return { showSkeleton, modalOpen, editingItem, openModal, closeModal, confirmDelete }
}
