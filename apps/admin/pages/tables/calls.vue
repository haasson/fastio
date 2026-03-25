<template>
  <TableCallSettings
    :call-types="ctx.callTypes"
    :active-calls="ctx.activeCalls"
    :tables="ctx.tables"
    @add-type="ctx.onCallTypeAdded"
    @remove-type="ctx.onCallTypeRemoved"
    @resolve="ctx.onCallResolved"
  />
</template>

<script setup lang="ts">
import { useTablesContext } from '~/composables/ui/useTablesContext'
import TableCallSettings from '~/components/tables/TableCallSettings.vue'

const ctx = useTablesContext()
</script>
