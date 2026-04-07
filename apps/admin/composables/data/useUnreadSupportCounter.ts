import { ref } from 'vue'

const count = ref(0)

export function useUnreadSupportCounter() {
  const set = (value: number) => {
    count.value = value
  }
  const reset = () => {
    count.value = 0
  }

  return { count, set, reset }
}
