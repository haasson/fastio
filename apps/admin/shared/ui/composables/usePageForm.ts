import { shallowRef, onScopeDispose, type ShallowRef } from 'vue'
import type { FormHandle } from './useEditableForm'

// shallowRef важен: внутри FormHandle лежат ComputedRef/Ref, обычный ref()
// развернёт их при unwrap'е и сломает типы и реактивность.
const pageForm = shallowRef<FormHandle | null>(null)

export const useRegisterPageForm = (form: FormHandle) => {
  if (pageForm.value && pageForm.value !== form) {
    // Регистрация поверх чужой формы означает, что одна из страниц останется без save-bar
    // и без unsaved-guard. В Nuxt SPA с одной активной страницей такого происходить не должно.
    console.warn('[usePageForm] перезаписываем уже зарегистрированную форму — на странице две регистрации pageForm?')
  }
  pageForm.value = form
  onScopeDispose(() => {
    if (pageForm.value === form) pageForm.value = null
  })
}

export const usePageForm = (): ShallowRef<FormHandle | null> => pageForm
