<template>
  <TabsLayout
    :tabs="tabs"
    base-path="/help"
    full-height
  >
    <template #extra>
      <UiButton
        tag="a"
        :href="helpUrl"
        target="_blank"
        icon="graduationCap"
        size="small"
      >
        Открыть базу знаний
      </UiButton>
    </template>
  </TabsLayout>
</template>

<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { storeToRefs } from 'pinia'
import { UiButton } from '@fastio/ui'
import { useRuntimeConfig, useRoute, useRouter } from '#imports'
import TabsLayout from '~/shared/ui/components/TabsLayout.vue'
import { usePageTitle } from '~/shared/composables/usePageTitle'
import { useTenantStore } from '~/shared/stores/tenant'

usePageTitle('Помощь')

const helpUrl = useRuntimeConfig().public.helpUrl

const { maybeTenant } = storeToRefs(useTenantStore())
const route = useRoute()
const router = useRouter()

// На заблокированном тенанте виртуальные туры бессмысленны (модули недоступны) —
// оставляем только Поддержку и уводим с любых других /help/* на support.
const isSuspended = computed(() => maybeTenant.value?.subscription?.status === 'suspended')

const tabs = computed(() => {
  const all = [
    { value: 'tours', label: 'Виртуальные туры' },
    { value: 'support', label: 'Поддержка' },
  ]

  return isSuspended.value ? all.filter((t) => t.value === 'support') : all
})

watchEffect(() => {
  if (isSuspended.value && route.path !== '/help/support') router.replace('/help/support')
})
</script>
