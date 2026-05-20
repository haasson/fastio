import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h, ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'

const successMock = vi.fn()
const errorMock = vi.fn()
const reportErrorMock = vi.fn()

vi.mock('@fastio/ui', () => ({
  useMessage: () => ({ success: successMock, error: errorMock }),
}))

vi.mock('@fastio/shared/observability', () => ({
  reportError: reportErrorMock,
}))

const { useEditableForm } = await import('../useEditableForm')

type Source = { a: number; b: string }
type Form = { a: number; b: string }

const setup = (
  saveImpl: (form: Form) => Promise<void>,
  options: { successMessage?: string; errorMessage?: string } = {},
) => {
  const source = ref<Source>({ a: 1, b: 'x' })
  let api: ReturnType<typeof useEditableForm<Source, Form>> | null = null

  const Host = defineComponent({
    setup() {
      api = useEditableForm({
        source,
        build: (s) => ({ a: s.a, b: s.b }),
        save: saveImpl,
        ...options,
      })

      return () => h('div', 'host')
    },
  })

  const wrapper = mount(Host)

  return { wrapper, source, getApi: () => api! }
}

describe('useEditableForm', () => {
  beforeEach(() => {
    successMock.mockReset()
    errorMock.mockReset()
    reportErrorMock.mockReset()
  })

  it('isDirty=false at start, true after change', async () => {
    const { getApi } = setup(async () => {})
    const api = getApi()

    expect(api.isDirty.value).toBe(false)
    api.form.a = 2
    await nextTick()
    expect(api.isDirty.value).toBe(true)
  })

  it('submit calls save, resets dirty, shows success', async () => {
    const save = vi.fn(async () => {})
    const { getApi } = setup(save)
    const api = getApi()

    api.form.a = 99
    await nextTick()
    await api.submit()

    expect(save).toHaveBeenCalledOnce()
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ a: 99 }))
    expect(api.isDirty.value).toBe(false)
    expect(successMock).toHaveBeenCalledWith('Сохранено')
  })

  it('uses custom successMessage', async () => {
    const { getApi } = setup(async () => {}, { successMessage: 'Готово' })

    getApi().form.a = 5
    await getApi().submit()
    expect(successMock).toHaveBeenCalledWith('Готово')
  })

  it('empty successMessage suppresses toast', async () => {
    const { getApi } = setup(async () => {}, { successMessage: '' })

    getApi().form.a = 5
    await getApi().submit()
    expect(successMock).not.toHaveBeenCalled()
  })

  it('save throws → saving=false, isDirty stays true, default error toast + reportError', async () => {
    const save = vi.fn(async () => {
      throw new Error('boom')
    })
    const { getApi } = setup(save)
    const api = getApi()

    api.form.a = 7
    await nextTick()
    await expect(api.submit()).rejects.toThrow('boom')
    expect(api.saving.value).toBe(false)
    expect(api.isDirty.value).toBe(true)
    expect(successMock).not.toHaveBeenCalled()
    expect(errorMock).toHaveBeenCalledWith('Не удалось сохранить')
    expect(reportErrorMock).toHaveBeenCalledOnce()
  })

  it('uses custom errorMessage', async () => {
    const save = vi.fn(async () => {
      throw new Error('boom')
    })
    const { getApi } = setup(save, { errorMessage: 'Беда' })

    getApi().form.a = 1
    await expect(getApi().submit()).rejects.toThrow('boom')
    expect(errorMock).toHaveBeenCalledWith('Беда')
  })

  it('empty errorMessage suppresses error toast (callback handles UX)', async () => {
    const save = vi.fn(async () => {
      throw new Error('boom')
    })
    const { getApi } = setup(save, { errorMessage: '' })

    getApi().form.a = 1
    await expect(getApi().submit()).rejects.toThrow('boom')
    expect(errorMock).not.toHaveBeenCalled()
    // reportError всё равно вызывается — диагностика не зависит от UX-флага
    expect(reportErrorMock).toHaveBeenCalledOnce()
  })

  it('cancelled error → no toast, no reportError, dirty stays', async () => {
    const save = vi.fn(async () => {
      throw new Error('cancelled')
    })
    const { getApi } = setup(save)
    const api = getApi()

    api.form.a = 42
    await nextTick()
    await expect(api.submit()).rejects.toThrow('cancelled')
    expect(errorMock).not.toHaveBeenCalled()
    expect(reportErrorMock).not.toHaveBeenCalled()
    expect(api.isDirty.value).toBe(true)
  })

  it('saving guard prevents concurrent submit', async () => {
    let resolveFirst: () => void = () => {}
    const save = vi.fn(() => new Promise<void>((r) => {
      resolveFirst = r
    }))
    const { getApi } = setup(save)
    const api = getApi()

    api.form.a = 1
    await nextTick()

    const p1 = api.submit()
    const p2 = api.submit()

    resolveFirst()
    await p1
    await p2

    expect(save).toHaveBeenCalledOnce()
  })

  it('source change rebuilds form and clears dirty', async () => {
    const { getApi, source } = setup(async () => {})
    const api = getApi()

    api.form.a = 100
    await nextTick()
    expect(api.isDirty.value).toBe(true)

    source.value = { a: 50, b: 'y' }
    await nextTick()

    expect(api.form.a).toBe(50)
    expect(api.form.b).toBe('y')
    expect(api.isDirty.value).toBe(false)
  })

  it('reset restores form to source snapshot', async () => {
    const { getApi } = setup(async () => {})
    const api = getApi()

    api.form.a = 999
    api.form.b = 'changed'
    await nextTick()
    expect(api.isDirty.value).toBe(true)

    api.reset()
    await nextTick()
    expect(api.form.a).toBe(1)
    expect(api.form.b).toBe('x')
    expect(api.isDirty.value).toBe(false)
  })
})
