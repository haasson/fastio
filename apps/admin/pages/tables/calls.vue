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
import { useTablesContext } from '~/features/tables'
import TableCallSettings from '~/features/tables/components/TableCallSettings.vue'

const ctx = useTablesContext()
</script>
