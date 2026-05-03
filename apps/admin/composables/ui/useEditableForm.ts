import { reactive, ref, watch, type ComputedRef, type Ref } from 'vue'
import { useMessage } from '@fastio/ui'
import { reportError } from '~/utils/reportError'
import { useFormDirty } from './useFormDirty'

export type FormHandle = {
  isDirty: ComputedRef<boolean> | Ref<boolean>
  saving: ComputedRef<boolean> | Ref<boolean>
  submit: () => Promise<void>
  reset: () => void
}

export type EditableForm<F extends object> = FormHandle & {
  form: F
}

type Options<S, F extends object> = {
  source: Ref<S> | ComputedRef<S>
  build: (source: S) => F
  save: (form: F) => Promise<void>
  successMessage?: string
  // Дефолтный error-toast при упавшем save. Передать '' чтобы подавить (если callback сам показывает ошибки).
  errorMessage?: string
}

// Save-callback может бросить эту ошибку, чтобы откатить submit без error-тоста и без сброса dirty
// (например, если пользователь закрыл confirm-модалку).
export const cancelSubmit = () => new Error('cancelled')

const isCancelled = (e: unknown) => e instanceof Error && e.message === 'cancelled'

export const useEditableForm = <S, F extends object>(opts: Options<S, F>): EditableForm<F> => {
  const form = reactive(opts.build(opts.source.value)) as F
  const { isDirty, reset: resetSnapshot } = useFormDirty(form as object)
  const saving = ref(false)
  const { success, error } = useMessage()

  watch(opts.source, (s) => {
    Object.assign(form, opts.build(s))
    resetSnapshot()
  })

  const submit = async () => {
    if (saving.value) return
    saving.value = true
    try {
      await opts.save(form)
      resetSnapshot()
      const msg = opts.successMessage ?? 'Сохранено'

      if (msg) success(msg)
    } catch (e) {
      if (!isCancelled(e)) {
        reportError(e)
        const msg = opts.errorMessage ?? 'Не удалось сохранить'

        if (msg) error(msg)
      }
      throw e
    } finally {
      saving.value = false
    }
  }

  const reset = () => {
    Object.assign(form, opts.build(opts.source.value))
    resetSnapshot()
  }

  return { form, isDirty, saving, submit, reset }
}
