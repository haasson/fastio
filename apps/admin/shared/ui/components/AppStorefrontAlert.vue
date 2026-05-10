<template>
  <UiAlert
    v-for="issue in issues"
    :key="issue.type"
    type="warning"
  >
    {{ issue.message }} —
    <NuxtLink :to="issue.link">настроить</NuxtLink>
  </UiAlert>
</template>

<script setup lang="ts">
import { UiAlert } from '@fastio/ui'
import type { SiteFeatureKey } from '@fastio/shared'
import { useStorefrontVisibility } from '~/composables/ui/useStorefrontVisibility'

const props = defineProps<{
  featureKey: SiteFeatureKey
}>()

const { issues } = useStorefrontVisibility(props.featureKey)
</script>
