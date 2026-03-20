<template>
  <PageShell>
    <FsSection>
      <FsHeading as="h2">Бронирование</FsHeading>
      <div class="stub">
        <SfEmptyState title="Бронирование" description="Раздел скоро появится">
          <CalendarCheck :size="48" />
        </SfEmptyState>
      </div>
    </FsSection>
  </PageShell>
</template>

<script setup lang="ts">
import { CalendarCheck } from 'lucide-vue-next'
import { FsSection, FsHeading } from '@fastio/public-ui'
import PageShell from '~/components/sections/PageShell.vue'
import SfEmptyState from '~/components/sf/domain/SfEmptyState.vue'
</script>

<style scoped>
.stub {
  margin-top: 32px;
}
</style>
