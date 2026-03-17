<template>
  <PageShell>
    <SfSection>
      <SfHeading as="h2">Бронирование</SfHeading>
      <div class="stub">
        <SfEmptyState title="Бронирование" description="Раздел скоро появится">
          <CalendarCheck :size="48" />
        </SfEmptyState>
      </div>
    </SfSection>
  </PageShell>
</template>

<script setup lang="ts">
import { CalendarCheck } from 'lucide-vue-next'
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
