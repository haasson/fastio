<template>
  <div class="skeleton-root">
    <FsCard v-for="i in count" :key="i">
      <div class="inner">
        <FsSkeleton
          v-for="(line, j) in lines"
          :key="j"
          :width="line.width"
          :height="line.height ?? '14px'"
        />
      </div>
    </FsCard>
  </div>
</template>

<script setup lang="ts">
import { FsCard, FsSkeleton } from '@fastio/public-ui'

type Line = { width: string; height?: string }

withDefaults(defineProps<{
  count?: number
  lines?: Line[]
}>(), {
  count: 3,
  lines: () => [
    { width: '40%', height: '16px' },
    { width: '75%' },
    { width: '50%', height: '13px' },
  ],
})
</script>

<style scoped lang="scss">
.skeleton-root {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.inner {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
}
</style>
