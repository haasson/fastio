import { ref, computed } from 'vue'

// Снимок через JSON.stringify — рассчитан на plain-объекты без циклов,
// Date/Map/Set. Для форм тенанта (строки, числа, булы, вложенные plain-объекты
// типа workingHoursSchedule) работает корректно: порядок ключей стабилен,
// Object.assign его сохраняет.
export const useFormDirty = <T extends object>(form: T) => {
  const snapshot = ref<string>(JSON.stringify(form))
  const isDirty = computed(() => JSON.stringify(form) !== snapshot.value)
  const reset = () => {
    snapshot.value = JSON.stringify(form)
  }

  return { isDirty, reset }
}
