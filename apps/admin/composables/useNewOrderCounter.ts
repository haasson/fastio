import { ref } from 'vue'

// Модуль-уровневый реф — одно состояние на всё приложение
const count = ref(0)

export function useNewOrderCounter() {
  const increment = () => count.value++
  const reset = () => {
    count.value = 0
  }

  return { count, increment, reset }
}
