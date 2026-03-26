<template>
  <PageShell>
    <FsSection>
      <StorePageLayout :breadcrumbs="[{ label: 'Главная', to: '/' }]" current="Галерея">
        <div class="gallery-content">
          <SfEmptyState title="Галерея пуста" description="Фотографии появятся здесь">
            <Image :size="48" />
          </SfEmptyState>
        </div>
      </StorePageLayout>
    </FsSection>
  </PageShell>
</template>

<script setup lang="ts">
import { Image } from 'lucide-vue-next'
import { FsSection } from '@fastio/public-ui'
import PageShell from '~/components/sections/PageShell.vue'
import SfEmptyState from '~/components/sf/domain/SfEmptyState.vue'
import StorePageLayout from '~/components/layout/StorePageLayout.vue'
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.gallery-content {
  margin-top: 32px;
}
</style>
