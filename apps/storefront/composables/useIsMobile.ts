import { ref, onMounted, onUnmounted } from 'vue'

export function useIsMobile(breakpoint = 768) {
  const isMobile = ref(true) // default to mobile (SSR-safe, mobile-first)

  let mql: MediaQueryList | null = null

  function update() {
    if (mql) isMobile.value = !mql.matches
  }

  onMounted(() => {
    mql = window.matchMedia(`(min-width: ${breakpoint}px)`)
    update()
    mql.addEventListener('change', update)
  })

  onUnmounted(() => {
    mql?.removeEventListener('change', update)
  })

  return isMobile
}
