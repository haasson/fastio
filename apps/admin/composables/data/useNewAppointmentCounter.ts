import { ref } from 'vue'

const count = ref(0)

export function useNewAppointmentCounter() {
  const increment = () => count.value++
  const reset = () => {
    count.value = 0
  }

  return { count, increment, reset }
}
