import { onBeforeUnmount, toValue, type MaybeRefOrGetter } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useConfirm } from '@fastio/kit'

export const useUnsavedGuard = (isDirty: MaybeRefOrGetter<boolean>) => {
  const { confirm } = useConfirm()

  onBeforeRouteLeave(async () => {
    if (!toValue(isDirty)) return true
    const ok = await confirm({
      title: 'Есть несохранённые изменения',
      message: 'Если уйти сейчас — все изменения будут потеряны.',
      confirmText: 'Уйти',
      cancelText: 'Остаться',
    })

    return ok === true
  })

  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (toValue(isDirty)) e.preventDefault()
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', onBeforeUnload)
    onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))
  }
}
