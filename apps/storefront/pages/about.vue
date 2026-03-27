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
          />

          <div
            v-if="aboutText"
            class="about-text"
            v-html="sanitizedText"
          />
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
import { FsSection } from '@fastio/public-ui'
import PageShell from '~/components/sections/PageShell.vue'
import SfEmptyState from '~/components/sf/domain/SfEmptyState.vue'
import StorePageLayout from '~/components/layout/StorePageLayout.vue'
import { useSafeHtml } from '~/composables/useSafeHtml'

const { data: tenant } = useNuxtData<Tenant>('tenant')

type SiteContentType = ReturnType<typeof defaultSiteContent>

const content = computed(() =>
  deepMerge(defaultSiteContent(), (tenant.value?.siteContent ?? {}) as Partial<SiteContentType>),
)

const coverUrl = computed(() => content.value.about?.coverUrl ?? null)
const aboutText = computed(() => content.value.about?.text ?? '')

const sanitizedText = useSafeHtml(aboutText)
</script>

<style scoped lang="scss">
.cover {
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border-radius: var(--card-radius);
  margin-bottom: 24px;
}

.about-text {
  line-height: 1.7;
  color: var(--color-text);

  :deep(p) { margin: 0 0 12px; }
  :deep(p:last-child) { margin-bottom: 0; }
  :deep(ul), :deep(ol) { padding-left: 20px; margin: 0 0 12px; }
  :deep(h2), :deep(h3) { margin: 0 0 8px; }
  :deep(a) { color: var(--color-primary); }
}
</style>
