import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { defineComponent, h, ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useModalHistory } from '../useModalHistory'

function makeModal(initialOpen = false) {
  const open = ref(initialOpen)
  const component = defineComponent({
    setup() {
      useModalHistory(
        () => open.value,
        () => { open.value = false },
      )
      return () => h('div')
    },
  })
  return { open, component }
}

async function firePopState() {
  window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }))
  await nextTick()
}

describe('useModalHistory', () => {
  const originalLength = history.length
  let backCount = 0
  let originalBack: typeof history.back

  beforeEach(() => {
    backCount = 0
    originalBack = history.back.bind(history)
    // Мокаем history.back: hapy-dom синхронно эмитит popstate, нам это и нужно.
    history.back = () => {
      backCount++
      const prev = history.state
      // эмулируем pop (state уходит, dispatchEvent)
      history.replaceState(null, '')
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
      // восстанавливаем для следующих пушей — hapy-dom хранит свою стек
      void prev
    }
  })

  afterEach(() => {
    history.back = originalBack
    // reset history state
    history.replaceState(null, '')
  })

  it('pushes history entry when modal opens', async () => {
    const { open, component } = makeModal(false)
    mount(component)
    await nextTick()
    open.value = true
    await nextTick()
    expect(history.state).toEqual({ fsModal: true })
  })

  it('programmatic close calls history.back once', async () => {
    const { open, component } = makeModal(false)
    mount(component)
    await nextTick()
    open.value = true
    await nextTick()
    open.value = false
    await nextTick()
    expect(backCount).toBe(1)
  })

  it('user back (popstate) closes modal without extra history.back', async () => {
    const { open, component } = makeModal(false)
    mount(component)
    await nextTick()
    open.value = true
    await nextTick()
    // Симулируем back браузера: popstate приходит сам, state сбрасывается
    history.replaceState(null, '')
    await firePopState()
    expect(open.value).toBe(false)
    // history.back() НЕ должен был быть вызван из composable — popstate сам пришёл
    expect(backCount).toBe(0)
  })

  it('ignores popstate that lands back on our fsModal record', async () => {
    // Сценарий: модалка открыта → fsModal на верху. Vue Router пушит свою запись.
    // Пользователь жмёт back → браузер возвращает на fsModal-запись → popstate.state = fsModal.
    // Это значит «мы ещё НА модалке», закрывать не надо.
    const { open, component } = makeModal(false)
    mount(component)
    await nextTick()
    open.value = true
    await nextTick()
    history.pushState({ router: 'other' }, '')
    window.dispatchEvent(new PopStateEvent('popstate', { state: { fsModal: true } }))
    await nextTick()
    expect(open.value).toBe(true)
  })

  it('pushes entry on mount when initially open (deeplink)', async () => {
    const { component } = makeModal(true)
    mount(component)
    await nextTick()
    expect(history.state).toEqual({ fsModal: true })
  })

  it('does not call history.back on unmount', async () => {
    const { open, component } = makeModal(false)
    const wrapper = mount(component)
    await nextTick()
    open.value = true
    await nextTick()
    backCount = 0
    wrapper.unmount()
    await nextTick()
    expect(backCount).toBe(0)
  })

  it('nested modals: back closes only the top one', async () => {
    const m1 = makeModal(false)
    const m2 = makeModal(false)
    mount(m1.component)
    mount(m2.component)
    await nextTick()
    m1.open.value = true
    await nextTick()
    m2.open.value = true
    await nextTick()
    // симулируем back
    history.replaceState(null, '')
    await firePopState()
    expect(m2.open.value).toBe(false)
    expect(m1.open.value).toBe(true)
  })
})
