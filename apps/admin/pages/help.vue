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
import { UiButton } from '@fastio/ui'
import { useRuntimeConfig } from '#imports'
import TabsLayout from '~/components/ui/TabsLayout.vue'
import { usePageTitle } from '~/composables/usePageTitle'

usePageTitle('Помощь')

const helpUrl = useRuntimeConfig().public.helpUrl

const tabs = [
  { value: 'tours', label: 'Виртуальные туры' },
  { value: 'support', label: 'Поддержка' },
]
</script>
