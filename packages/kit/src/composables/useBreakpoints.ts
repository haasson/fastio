import { computed, onMounted, ref } from 'vue'
import type { Breakpoint } from '../types/responsive'
import { throttle } from '../utils/throttle'

const breakpoints: Record<Breakpoint, number> = {
  s: 320,
  m: 800,
  l: 1280,
  xl: 1536,
}

const DEFAULT_SSR_BREAKPOINT: Breakpoint = 'l'

const isMounted = ref(false)
const windowWidth = ref(0)

const updateWindowWidth = () => {
  if (typeof window !== 'undefined') {
    windowWidth.value = window.innerWidth
  }
}

const handleResize = throttle(updateWindowWidth, 100)

const getActiveBreakpoint = (width: number): Breakpoint => {
  if (width >= breakpoints.xl) return 'xl'
  if (width >= breakpoints.l) return 'l'
  if (width >= breakpoints.m) return 'm'
  return 's'
}

const getCurrentBreakpoints = (activeBreakpoint: Breakpoint): Breakpoint[] => {
  const order: Breakpoint[] = ['s', 'm', 'l', 'xl']
  const activeIndex = order.indexOf(activeBreakpoint)
  return order.slice(0, activeIndex + 1)
}

const active = computed(() =>
  isMounted.value ? getActiveBreakpoint(windowWidth.value) : DEFAULT_SSR_BREAKPOINT,
)

const current = computed(() =>
  getCurrentBreakpoints(active.value),
)

const s = computed(() => current.value.includes('s'))
const m = computed(() => current.value.includes('m'))
const l = computed(() => current.value.includes('l'))
const xl = computed(() => current.value.includes('xl'))

const sOnly = computed(() => active.value === 's')
const mOnly = computed(() => active.value === 'm')
const lOnly = computed(() => active.value === 'l')
const xlOnly = computed(() => active.value === 'xl')

const useBreakpoints = () => {
  onMounted(() => {
    if (!isMounted.value) {
      if (typeof window !== 'undefined') {
        updateWindowWidth()
        window.addEventListener('resize', handleResize)
      }
      isMounted.value = true
    }
  })

  return {
    breakpoints,
    active,
    current,
    s, m, l, xl,
    sOnly, mOnly, lOnly, xlOnly,
  }
}

export default useBreakpoints
