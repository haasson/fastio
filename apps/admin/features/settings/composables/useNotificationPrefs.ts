import { useLocalStorage } from '@vueuse/core'

export function useNotificationPrefs() {
  const blinkingCounter = useLocalStorage('notif-blink-counter', true)

  return { blinkingCounter }
}
