import { watchEffect, isRef, type MaybeRef } from 'vue'
import { useState } from '#imports'

export const usePageTitle = (title?: MaybeRef<string>) => {
  const state = useState<string>('page-title', () => '')

  if (title !== undefined) {
    if (isRef(title)) {
      watchEffect(() => {
        state.value = title.value
      })
    } else {
      state.value = title
    }
  }

  return state
}
