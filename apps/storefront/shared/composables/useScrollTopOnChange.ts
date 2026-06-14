import { watch } from 'vue'
import type { WatchSource } from 'vue'

// Скроллит окно к началу при изменении источника — для пошаговых флоу,
// где роут не меняется, а контент да (бронирование, запись на услугу).
// Скролл при смене роута закрывается отдельно в app/router.options.ts.
export function useScrollTopOnChange(source: WatchSource) {
  watch(source, () => {
    if (!import.meta.client) return
    window.scrollTo({ top: 0, behavior: 'smooth' })
  })
}
