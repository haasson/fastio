<template>
  <PageShell>
    <FsSection>
      <FsHeading as="h2">Доставка</FsHeading>
      <div class="stub">
        <SfEmptyState title="Информация о доставке" description="Раздел скоро появится">
          <Truck :size="48" />
        </SfEmptyState>
      </div>
    </FsSection>
  </PageShell>
</template>

<script setup lang="ts">
import { Truck } from 'lucide-vue-next'
import { FsSection, FsHeading } from '@fastio/public-ui'
import PageShell from '~/components/sections/PageShell.vue'
import SfEmptyState from '~/components/sf/domain/SfEmptyState.vue'
</script>

<style scoped>
.stub {
  margin-top: 32px;
}
</style>
