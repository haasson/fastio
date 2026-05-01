import { ref } from 'vue'

/**
 * Глобальный счётчик «инбокса записи»: новые группы + заявки в работе.
 *
 * INVARIANT: единственное место, где этот счётчик пересчитывается из БД —
 * `useAppointmentInboxHandler`. Он ОБЯЗАТЕЛЬНО монтируется в
 * `useRealtimeChannels.ts` рядом с другими каналами. Без хэндлера значение
 * `count` навсегда останется 0 и потребители (например, бейдж в `AppNav`)
 * будут видеть нули.
 *
 * Сам composable — чистая обёртка над module-level ref: позволяет читать
 * текущее значение из любых компонентов и обновлять его из хэндлера.
 */
const count = ref(0)

export function useAppointmentInboxCounter() {
  const set = (n: number) => {
    count.value = n
  }

  return { count, set }
}
