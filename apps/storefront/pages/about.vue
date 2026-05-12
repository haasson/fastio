<template>
  <PageShell>
    <FsSection>
      <StorePageLayout :breadcrumbs="[{ label: 'Главная', to: '/' }]" current="О нас">
        <template v-if="coverUrl || aboutText">
          <img
            v-if="coverUrl"
            :src="coverUrl"
            alt=""
            class="cover"
            loading="lazy"
          >

          <FsRichContent v-if="aboutText" :html="aboutText" />
        </template>

        <SfEmptyState
          v-else
          title="О нас"
          description="Раздел скоро появится"
        >
          <Info :size="48" />
        </SfEmptyState>
      </StorePageLayout>
    </FsSection>
  </PageShell>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Info } from 'lucide-vue-next'
import { useNuxtData } from 'nuxt/app'
import type { Tenant } from '@fastio/shared'
import { defaultSiteContent, deepMerge } from '@fastio/shared'
import { FsSection, FsRichContent } from '@fastio/public-ui'
import PageShell from '~/shared/ui/sections/PageShell.vue'
import SfEmptyState from '~/shared/ui/sf/domain/SfEmptyState.vue'
import StorePageLayout from '~/shared/ui/layout/StorePageLayout.vue'

const { data: tenant } = useNuxtData<Tenant>('tenant')

type SiteContentType = ReturnType<typeof defaultSiteContent>

const content = computed(() =>
  deepMerge(defaultSiteContent(), (tenant.value?.siteContent ?? {}) as Partial<SiteContentType>),
)

const coverUrl = computed(() => content.value.about?.coverUrl ?? null)
const aboutText = computed(() => content.value.about?.text ?? '')
</script>

<style scoped lang="scss">
.cover {
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border-radius: var(--card-radius);
  margin-bottom: 24px;
}
</style>
