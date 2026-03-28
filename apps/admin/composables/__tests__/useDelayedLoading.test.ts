import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ref } from 'vue'
import useDelayedLoading from '../ui/useDelayedLoading'

describe('useDelayedLoading', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('изначально showSkeleton=false', () => {
    const loading = ref(false)
    const { showSkeleton } = useDelayedLoading(loading)

    expect(showSkeleton.value).toBe(false)
  })

  it('loading=true сразу — showSkeleton ещё false (delay не истёк)', async () => {
    const loading = ref(false)
    const { showSkeleton } = useDelayedLoading(loading, 1000)

    loading.value = true
    await vi.advanceTimersByTimeAsync(999)
    expect(showSkeleton.value).toBe(false)
  })

  it('loading=true → после delay → showSkeleton=true', async () => {
    const loading = ref(false)
    const { showSkeleton } = useDelayedLoading(loading, 1000)

    loading.value = true
    await vi.advanceTimersByTimeAsync(1000)
    expect(showSkeleton.value).toBe(true)
  })

  it('loading=true → loading=false до истечения delay → showSkeleton остаётся false', async () => {
    const loading = ref(false)
    const { showSkeleton } = useDelayedLoading(loading, 1000)

    loading.value = true
    await vi.advanceTimersByTimeAsync(500)
    loading.value = false
    await vi.advanceTimersByTimeAsync(1000)
    expect(showSkeleton.value).toBe(false)
  })

  it('loading=true → показался → loading=false → showSkeleton сбрасывается', async () => {
    const loading = ref(false)
    const { showSkeleton } = useDelayedLoading(loading, 1000)

    loading.value = true
    await vi.advanceTimersByTimeAsync(1000)
    expect(showSkeleton.value).toBe(true)
    loading.value = false
    await vi.advanceTimersByTimeAsync(0)
    expect(showSkeleton.value).toBe(false)
  })

  it('кастомный delay работает', async () => {
    const loading = ref(false)
    const { showSkeleton } = useDelayedLoading(loading, 300)

    loading.value = true
    await vi.advanceTimersByTimeAsync(299)
    expect(showSkeleton.value).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(showSkeleton.value).toBe(true)
  })
})
