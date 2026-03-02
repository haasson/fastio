export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let lastCall = 0
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return (...args: Parameters<T>) => {
    const now = Date.now()

    if (timeoutId !== null) {
      clearTimeout(timeoutId)
      timeoutId = null
    }

    if (now - lastCall >= delay) {
      lastCall = now
      fn(...args)
    } else {
      const remaining = delay - (now - lastCall)

      timeoutId = setTimeout(() => {
        lastCall = Date.now()
        timeoutId = null
        fn(...args)
      }, remaining)
    }
  }
}
