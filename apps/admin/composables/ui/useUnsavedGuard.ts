import { onBeforeUnmount } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useConfirm } from '@fastio/kit'
import type { Ref } from 'vue'

export const useUnsavedGuard = (isDirty: Ref<boolean>) => {
  const { confirm } = useConfirm()

  onBeforeRouteLeave(async () => {
    if (!isDirty.value) return true
    const ok = await confirm({
      title: 'Есть несохранённые изменения',
      message: 'Если уйти сейчас — все изменения будут потеряны.',
      confirmText: 'Уйти',
      cancelText: 'Остаться',
    })

    return ok === true
  })

  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (isDirty.value) e.preventDefault()
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', onBeforeUnload)
    onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))
  }
}
