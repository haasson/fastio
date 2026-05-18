import { ref, reactive } from 'vue'
import { useRequestFetch } from 'nuxt/app'
import type { ReservationStatus } from '@fastio/shared'
import { useSupabaseClient } from '~/shared/composables/useSupabaseClient'
import { useSelectedBranchStore } from '~/features/branch'

type Slot = { time: string; available: boolean }

type BookingForm = {
  date: string
  guestCount: number
  branchId: string | null
  time: string
  guestName: string
  guestPhone: string
  guestEmail: string
  comment: string
}

export default function useBooking() {
  // Заведения с выбранным филиалом (per_branch / unified с одним выбранным —
  // оба валидны) пробрасывают filter→submit, чтобы бронь падала в правильный
  // филиал, а не в `branch_id=null` (старое поведение «бэк подберёт сам»).
  const selectedBranch = useSelectedBranchStore()
  const step = ref<1 | 2 | 3>(1)
  const form = reactive<BookingForm>({
    date: '',
    guestCount: 2,
    branchId: selectedBranch.id ?? null,
    time: '',
    guestName: '',
    guestPhone: '',
    guestEmail: '',
    comment: '',
  })
  const slots = ref<Slot[]>([])
  const loading = ref(false)
  const result = ref<{ id: string; status: ReservationStatus; linkedToAccount: boolean } | null>(null)
  const wasAuthenticated = ref(false)
  const error = ref<string | null>(null)
  // Регенерируется на каждый USER-initiated submit (см. submit). Защищает от
  // двойного тапа / refresh во время submit / медленной сети: сервер вернёт
  // существующую бронь вместо создания второй. Auto-retry'я нет —
  // простой реген-на-попытку безопасен.
  const idempotencyKey = ref<string | null>(null)

  const rfetch = useRequestFetch()
  const supabase = useSupabaseClient()

  const fetchSlots = async () => {
    if (!form.date) return
    loading.value = true
    error.value = null

    try {
      const params = new URLSearchParams({ date: form.date, guests: String(form.guestCount) })
      if (form.branchId) params.set('branchId', form.branchId)

      slots.value = await rfetch<Slot[]>(`/api/reservations/slots?${params}`)
    } catch (e: unknown) {
      const err = e as { data?: { message?: string } }

      error.value = err?.data?.message ?? 'Не удалось загрузить слоты'
      slots.value = []
    } finally {
      loading.value = false
    }
  }

  const submit = async () => {
    loading.value = true
    error.value = null

    // НЕ переиспользуем старый ключ — если предыдущая попытка дошла до БД и
    // создала бронь, сервер вернёт ту же бронь при повторном submit с тем же
    // ключом (мы хотим именно это для retry'я). Новый ключ = новая попытка
    // с актуальными данными формы.
    idempotencyKey.value = crypto.randomUUID()

    try {
      const headers: Record<string, string> = {}
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
        wasAuthenticated.value = true
      }

      result.value = await rfetch<{ id: string; status: ReservationStatus; linkedToAccount: boolean }>('/api/reservations', {
        method: 'POST',
        headers,
        body: {
          guestName: form.guestName,
          guestPhone: form.guestPhone,
          guestEmail: form.guestEmail || null,
          guestCount: form.guestCount,
          reservedDate: form.date,
          reservedTime: form.time,
          comment: form.comment || null,
          branchId: form.branchId || selectedBranch.id || null,
          idempotencyKey: idempotencyKey.value,
        },
      })

      // Ключ отыграл свою роль — сбрасываем. Следующий submit (например, после
      // back/forward на step 1 и нового submit) сгенерит новый ключ.
      idempotencyKey.value = null
    } catch (e: unknown) {
      const err = e as { data?: { message?: string } }

      error.value = err?.data?.message ?? 'Не удалось создать бронь'
    } finally {
      loading.value = false
    }
  }

  return { step, form, slots, loading, result, wasAuthenticated, error, fetchSlots, submit }
}
