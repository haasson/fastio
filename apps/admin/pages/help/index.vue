<template>
  <div />
</template>

<script setup lang="ts">
import { navigateTo } from '#imports'
import { useTenantStore } from '~/shared/stores/tenant'

// На заблокированном тенанте туры скрыты — сразу на поддержку (иначе мелькнёт tours).
const suspended = useTenantStore().maybeTenant?.subscription?.status === 'suspended'

navigateTo(suspended ? '/help/support' : '/help/tours', { replace: true })
</script>
