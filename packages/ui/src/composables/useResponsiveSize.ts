import { computed, inject, type ComputedRef } from 'vue'
import useBreakpoints from './useBreakpoints'
import type { Size, Breakpoint, ResponsiveSizeMap } from '../types/responsive'
import { BREAKPOINTS_ORDER } from '../types/responsive'
import { FORM_SIZE_KEY } from '../constants/form-size'

type UseResponsiveSizeOptions = {
  size: Size
  responsive?: ResponsiveSizeMap
}

const resolveFromMap = (map: ResponsiveSizeMap, breakpoint: Breakpoint): Size | undefined => {
  const currentIndex = BREAKPOINTS_ORDER.indexOf(breakpoint)

  for (let i = currentIndex; i >= 0; i--) {
    const bp = BREAKPOINTS_ORDER[i]
    if (map[bp] !== undefined) return map[bp]
  }

  return undefined
}

const useResponsiveSize = (options: UseResponsiveSizeOptions): ComputedRef<Size> => {
  const { active } = useBreakpoints()
  const formResponsive = inject(FORM_SIZE_KEY, undefined)

  return computed<Size>(() => {
    const currentBreakpoint = active.value as Breakpoint

    if (options.responsive) {
      return resolveFromMap(options.responsive, currentBreakpoint) ?? options.size
    }

    if (formResponsive?.value) {
      return resolveFromMap(formResponsive.value, currentBreakpoint) ?? options.size
    }

    return options.size
  })
}

export default useResponsiveSize
