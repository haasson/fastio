import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h, ref, nextTick, type Ref } from 'vue'
import { mount } from '@vue/test-utils'

const confirmMock: ReturnType<typeof vi.fn> = vi.fn()

let leaveGuard: ((...args: unknown[]) => unknown) | null = null
const onBeforeRouteLeaveMock = vi.fn((cb: (...args: unknown[]) => unknown) => {
  leaveGuard = cb
})

vi.mock('vue-router', () => ({
  onBeforeRouteLeave: onBeforeRouteLeaveMock,
}))

vi.mock('@fastio/kit', () => ({
  useConfirm: () => ({ confirm: confirmMock }),
}))

const { useUnsavedGuard } = await import('../ui/useUnsavedGuard')

const mountHost = (isDirty: Ref<boolean>) => {
  const Host = defineComponent({
    setup() {
      useUnsavedGuard(isDirty)

      return () => h('div', 'host')
    },
  })

  return mount(Host)
}

describe('useUnsavedGuard', () => {
  beforeEach(() => {
    confirmMock.mockReset()
    onBeforeRouteLeaveMock.mockClear()
    leaveGuard = null
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('registers onBeforeRouteLeave guard', () => {
    const isDirty = ref(false)

    mountHost(isDirty)
    expect(onBeforeRouteLeaveMock).toHaveBeenCalledOnce()
    expect(leaveGuard).toBeTypeOf('function')
  })

  it('leave guard returns true when not dirty (no confirm)', async () => {
    const isDirty = ref(false)

    mountHost(isDirty)
    const result = await leaveGuard!()

    expect(result).toBe(true)
    expect(confirmMock).not.toHaveBeenCalled()
  })

  it('leave guard returns true when dirty and user confirms', async () => {
    const isDirty = ref(true)

    confirmMock.mockResolvedValueOnce(true)
    mountHost(isDirty)

    const result = await leaveGuard!()

    expect(result).toBe(true)
    expect(confirmMock).toHaveBeenCalledOnce()
  })

  it('leave guard returns false when dirty and user cancels', async () => {
    const isDirty = ref(true)

    confirmMock.mockResolvedValueOnce(false)
    mountHost(isDirty)

    const result = await leaveGuard!()

    expect(result).toBe(false)
  })

  it('registers and cleans up beforeunload listener', async () => {
    const listeners = new Set<EventListener>()
    const addSpy = vi.spyOn(window, 'addEventListener').mockImplementation((type, cb) => {
      if ((type as string) === 'beforeunload' && typeof cb === 'function') listeners.add(cb as EventListener)
    })
    const removeSpy = vi.spyOn(window, 'removeEventListener').mockImplementation((type, cb) => {
      if ((type as string) === 'beforeunload' && typeof cb === 'function') listeners.delete(cb as EventListener)
    })

    const isDirty = ref(false)
    const wrapper = mountHost(isDirty)

    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))
    expect(listeners.size).toBe(1)

    wrapper.unmount()
    await nextTick()
    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))
    expect(listeners.size).toBe(0)
  })

  it('preventDefault on beforeunload when dirty', () => {
    let registered: EventListener | null = null

    vi.spyOn(window, 'addEventListener').mockImplementation((type, cb) => {
      if ((type as string) === 'beforeunload' && typeof cb === 'function') registered = cb as EventListener
    })

    const isDirty = ref(true)

    mountHost(isDirty)
    expect(registered).not.toBeNull()

    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent
    const preventSpy = vi.spyOn(event, 'preventDefault')

    registered!(event)
    expect(preventSpy).toHaveBeenCalled()
  })

  it('does not preventDefault when not dirty', () => {
    let registered: EventListener | null = null

    vi.spyOn(window, 'addEventListener').mockImplementation((type, cb) => {
      if ((type as string) === 'beforeunload' && typeof cb === 'function') registered = cb as EventListener
    })

    const isDirty = ref(false)

    mountHost(isDirty)

    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent
    const preventSpy = vi.spyOn(event, 'preventDefault')

    registered!(event)
    expect(preventSpy).not.toHaveBeenCalled()
  })
})
