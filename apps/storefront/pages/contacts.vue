<template>
  <PageShell>
    <SfSection>
      <SfHeading as="h2">Контакты</SfHeading>
      <div class="stub">
        <SfEmptyState title="Контакты" description="Раздел скоро появится">
          <MapPin :size="48" />
        </SfEmptyState>
      </div>
    </SfSection>
  </PageShell>
</template>

<script setup lang="ts">
import { MapPin } from 'lucide-vue-next'
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
