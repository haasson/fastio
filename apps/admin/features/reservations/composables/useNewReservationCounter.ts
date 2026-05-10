import { ref } from 'vue'

// Module-level ref — one state across the whole app
const count = ref(0)

export function useNewReservationCounter() {
  const increment = () => count.value++
  const reset = () => {
    count.value = 0
  }

  return { count, increment, reset }
}
