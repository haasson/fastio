import { computed } from 'vue'
import { useNuxtData } from 'nuxt/app'
import type { AppointmentSettings } from '@fastio/shared'

export function useResourceLabel() {
  const { data } = useNuxtData<Partial<AppointmentSettings>>('appointment-settings')

  const lower = computed(() => (data.value?.resourceLabel || 'мастер').trim().toLowerCase())
  const capitalized = computed(() => {
    const v = lower.value
    return v ? v.charAt(0).toUpperCase() + v.slice(1) : ''
  })
  const anyLabel = computed(() => `Любой ${lower.value}`)

  return { lower, capitalized, anyLabel }
}
