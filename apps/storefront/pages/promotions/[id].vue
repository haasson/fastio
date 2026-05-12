<template>
  <PageShell>
    <FsSection>
      <StorePageLayout v-if="promo" :breadcrumbs="[{ label: 'Главная', to: '/' }]" :current="promo.title">
        <div v-if="promo.type === 'promo_code'" class="code-block">
          <FsText size="small" color="secondary">Промокод</FsText>
          <div class="code-row">
            <span class="code">{{ promo.code }}</span>
            <button type="button" class="copy-btn" :class="{ copied }" @click="copyCode">
              <span>{{ copied ? 'Скопировано' : 'Скопировать' }}</span>
            </button>
          </div>
        </div>

        <FsRichContent v-if="promo.content" :html="promo.content" />
      </StorePageLayout>
    </FsSection>
  </PageShell>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAsyncData, useRequestFetch, useRoute, createError } from 'nuxt/app'
import { FsSection, FsText, FsRichContent } from '@fastio/public-ui'
import PageShell from '~/shared/ui/sections/PageShell.vue'
import StorePageLayout from '~/shared/ui/layout/StorePageLayout.vue'

definePageMeta({ middleware: ['no-promotions'] })

const route = useRoute()
const rfetch = useRequestFetch()
const id = route.params.id as string
const slugQuery = route.query.slug ? { query: { slug: route.query.slug } } : {}

type PromoPageData = {
  id: string
  title: string
  content: string
  bannerUrl: string | null
  type: 'promotion' | 'promo_code'
  code?: string
}

const { data: promo, error } = await useAsyncData<PromoPageData>(
  `promo-${id}`,
  () => rfetch(`/api/promo/${id}`, slugQuery),
)

if (error.value || !promo.value) {
  throw createError({ statusCode: 404, fatal: true })
}

const copied = ref(false)

const copyCode = async () => {
  if (!promo.value?.code) return
  await navigator.clipboard.writeText(promo.value.code)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}
</script>

<style scoped lang="scss">
.code-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}

.code-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.code {
  font-family: monospace;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--primary);
  background: var(--bg-secondary, rgba(0, 0, 0, 0.04));
  padding: 6px 16px;
  border-radius: 8px;
  border: 1.5px dashed var(--primary);
}

.copy-btn {
  padding: 6px 14px;
  border-radius: 8px;
  border: 1.5px solid var(--primary);
  background: transparent;
  color: var(--primary);
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: background 0.15s, color 0.15s;

  &:hover {
    background: var(--primary);
    color: #fff;
  }

  &.copied {
    background: var(--primary);
    color: #fff;
  }
}
</style>
