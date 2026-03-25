<template>
  <TablesCanvas
    :tables="ctx.tables"
    :global-tags="ctx.globalTags"
    @add="ctx.onTableAdded"
    @update="ctx.onTableUpdated"
    @delete="ctx.onTableDeleted"
    @update-position="ctx.onPositionUpdated"
    @update:global-tags="ctx.onGlobalTagsUpdated"
  />
</template>

<script setup lang="ts">
import { useTablesContext } from '~/composables/ui/useTablesContext'
import TablesCanvas from '~/components/tables/TablesCanvas.vue'

const ctx = useTablesContext()
</script>
