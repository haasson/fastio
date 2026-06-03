import 'vue-yandex-maps/css'
import { defineNuxtPlugin, useRuntimeConfig } from '#imports'
import { createYmapsOptions } from 'vue-yandex-maps'

export default defineNuxtPlugin(() => {
  const apiKey = useRuntimeConfig().public.yandexMapsApiKey as string
  // Без ключа createYmapsOptions кидает синхронно → роняет весь клиент в 500-страницу
  // на любом маршруте (а не только там, где есть карта). Карты деградируют тихо.
  // Тот же guard уже стоит в apps/admin/plugins/yandex-maps.client.ts.
  if (apiKey) createYmapsOptions({ apikey: apiKey })
})
