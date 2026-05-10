import { watch } from 'vue'
import { defineNuxtPlugin } from '#imports'
import { useTenantStore } from '~/shared/stores/tenant'
import { setVocab } from '~/features/legal'

/**
 * Связывает текущий тенант со словарём терминов.
 * Когда businessType/menuStyle меняется (логин, switchTenant, обновление
 * настроек), пересчитываем терминологию для всего UI.
 *
 * Живёт в plugin'е, а не в `useTenant`/`useTerms`, чтобы стор тенанта
 * и стор терминов не знали друг о друге напрямую.
 */
export default defineNuxtPlugin(() => {
  const tenantStore = useTenantStore()

  watch(
    () => tenantStore.maybeTenant,
    (t) => setVocab(t?.businessType ?? null, t?.menuStyle ?? 'food'),
    { immediate: true },
  )
})
