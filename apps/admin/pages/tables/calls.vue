<template>
  <TableActiveCalls
    :active-calls="ctx.activeCalls"
    :tables="ctx.tables"
    @resolve="ctx.onCallResolved"
  />
</template>

<script setup lang="ts">
import { useTablesContext } from '~/features/tables'
import TableActiveCalls from '~/features/tables/components/TableActiveCalls.vue'

const ctx = useTablesContext()
</script>
