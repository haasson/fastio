<template>
  <PageShell>
    <SfSection>
      <SfHeading as="h2">Доставка</SfHeading>
      <div class="stub">
        <SfEmptyState title="Информация о доставке" description="Раздел скоро появится">
          <Truck :size="48" />
        </SfEmptyState>
      </div>
    </SfSection>
  </PageShell>
</template>

<script setup lang="ts">
import { Truck } from 'lucide-vue-next'
import PageShell from '~/components/sections/PageShell.vue'
import SfSection from '~/components/sf/layout/SfSection.vue'
import SfHeading from '~/components/sf/typography/SfHeading.vue'
import SfEmptyState from '~/components/sf/domain/SfEmptyState.vue'
</script>

<style scoped>
.stub {
  margin-top: 32px;
}
</style>
