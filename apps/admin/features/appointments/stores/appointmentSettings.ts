import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AppointmentSettings, AppointmentResourceMode } from '@fastio/shared'
import { DEFAULT_APPOINTMENT_SETTINGS } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useDatabase } from '~/composables/data/useDatabase'

export const useAppointmentSettingsStore = defineStore('appointmentSettings', () => {
  const tenantStore = useTenantStore()
  const api = useDatabase()

  const settings = ref<AppointmentSettings | null>(null)
  const loading = ref(false)

  const resourceMode = computed<AppointmentResourceMode>(() => settings.value?.resourceMode ?? DEFAULT_APPOINTMENT_SETTINGS.resourceMode)

  const load = async (force = false) => {
    const tid = tenantStore.currentTenantId

    if (!tid) {
      settings.value = null

      return
    }
    if (!force && settings.value?.tenantId === tid) return
    loading.value = true
    try {
      settings.value = await api.appointmentSettings.get(tid)
    } finally {
      loading.value = false
    }
  }

  const refresh = () => load(true)

  return {
    settings,
    loading,
    resourceMode,
    load,
    refresh,
  }
})
