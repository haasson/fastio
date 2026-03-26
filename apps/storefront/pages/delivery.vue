<template>
  <PageShell>
    <FsSection>
      <StorePageLayout :breadcrumbs="[{ label: 'Главная', to: '/' }]" current="Доставка">
        <div class="stub">
          <SfEmptyState title="Информация о доставке" description="Раздел скоро появится">
            <Truck :size="48" />
          </SfEmptyState>
        </div>
      </StorePageLayout>
    </FsSection>
  </PageShell>
</template>

<script setup lang="ts">
import { Truck } from 'lucide-vue-next'
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
