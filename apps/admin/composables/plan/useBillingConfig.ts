import { ref } from 'vue'
import { DEFAULT_TRIAL_DAYS } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import { reportError } from '~/utils/reportError'

const trialDays = ref(DEFAULT_TRIAL_DAYS)
const loaded = ref(false)
const failed = ref(false)

/**
 * Глобальный кэш для billing_config: грузим один раз за сессию.
 * Если запрос упал — failed=true чтобы UI мог показать предупреждение.
 */
export const useBillingConfig = () => {
  const api = useDatabase()

  const load = async () => {
    if (loaded.value) return
    try {
      const config = await api.billing.getConfig()

      trialDays.value = config.trialDays
      loaded.value = true
      failed.value = false
    } catch (e) {
      reportError(e)
      failed.value = true
    }
  }

  return { trialDays, loaded, failed, load }
}
