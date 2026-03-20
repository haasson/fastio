<template>
  <PageShell>
    <FsSection>
      <FsHeading as="h2">Вакансии</FsHeading>
      <div class="stub">
        <SfEmptyState title="Вакансии" description="Раздел скоро появится">
          <Briefcase :size="48" />
        </SfEmptyState>
      </div>
    </FsSection>
  </PageShell>
</template>

<script setup lang="ts">
import { Briefcase } from 'lucide-vue-next'
import { FsSection, FsHeading } from '@fastio/public-ui'
import PageShell from '~/components/sections/PageShell.vue'
import SfEmptyState from '~/components/sf/domain/SfEmptyState.vue'
</script>

<style scoped>
.stub {
  margin-top: 32px;
}
</style>
