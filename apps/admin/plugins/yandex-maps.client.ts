import { defineNuxtPlugin, useRuntimeConfig } from '#imports'
import { createYmapsOptions } from 'vue-yandex-maps'

export default defineNuxtPlugin(() => {
  const apiKey = useRuntimeConfig().public.yandexMapsApiKey as string

  if (apiKey) createYmapsOptions({ apikey: apiKey })
})
