import { ref, reactive } from 'vue'
import { useRequestFetch } from 'nuxt/app'
import type { ReservationStatus } from '@fastio/shared'
import { useSupabaseClient } from '~/composables/useSupabaseClient'

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
  const step = ref<1 | 2 | 3>(1)
  const form = reactive<BookingForm>({
    date: '',
    guestCount: 2,
    branchId: null,
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

  const rfetch = useRequestFetch()
  const supabase = useSupabaseClient()

  const fetchSlots = async () => {
    if (!form.date) return
    loading.value = true
    error.value = null

    try {
      const params = new URLSearchParams({ date: form.date, guests: String(form.guestCount) })

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
          branchId: form.branchId || null,
        },
      })
    } catch (e: unknown) {
      const err = e as { data?: { message?: string } }

      error.value = err?.data?.message ?? 'Не удалось создать бронь'
    } finally {
      loading.value = false
    }
  }

  return { step, form, slots, loading, result, wasAuthenticated, error, fetchSlots, submit }
}
