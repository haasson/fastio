<template>
  <PageShell>
    <FsSection>
      <StorePageLayout :breadcrumbs="[{ label: 'Главная', to: '/' }]" current="Вакансии">
        <div class="stub">
          <SfEmptyState title="Вакансии" description="Раздел скоро появится">
            <Briefcase :size="48" />
          </SfEmptyState>
        </div>
      </StorePageLayout>
    </FsSection>
  </PageShell>
</template>

<script setup lang="ts">
import { Briefcase } from 'lucide-vue-next'
import { FsSection } from '@fastio/public-ui'
import PageShell from '~/components/sections/PageShell.vue'
import SfEmptyState from '~/components/sf/domain/SfEmptyState.vue'
import StorePageLayout from '~/components/layout/StorePageLayout.vue'
</script>

<style scoped>
.stub {
  margin-top: 32px;
}
</style>
