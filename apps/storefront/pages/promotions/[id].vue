<template>
  <PageShell>
    <div class="promo-root">
      <div v-if="promo.bannerUrl" class="banner">
        <img :src="promo.bannerUrl" alt="" class="banner-img" />
      </div>

      <FsSection class="content-section">
        <FsHeading as="h1" class="title">{{ promo.title }}</FsHeading>

        <div v-if="promo.type === 'promo_code'" class="code-block">
          <FsText size="small" color="secondary">Промокод</FsText>
          <div class="code-row">
            <span class="code">{{ promo.code }}</span>
            <button type="button" class="copy-btn" :class="{ copied }" @click="copyCode">
              <span>{{ copied ? 'Скопировано' : 'Скопировать' }}</span>
            </button>
          </div>
        </div>

        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-if="promo.content" class="rich-content" v-html="promo.content" />
      </FsSection>
    </div>
  </PageShell>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAsyncData, useRequestFetch, useRoute, createError } from 'nuxt/app'
import { FsSection, FsHeading, FsText } from '@fastio/public-ui'
import PageShell from '~/components/sections/PageShell.vue'

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
@use '~/assets/styles/mixins' as *;

.promo-root {
  display: flex;
  flex-direction: column;
}

.banner {
  width: 100%;
  aspect-ratio: 3 / 1;
  overflow: hidden;
}

.banner-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.content-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.title {
  margin: 0;
}

.code-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
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

.rich-content {
  :deep(h1), :deep(h2), :deep(h3) {
    margin: 0.75em 0 0.25em;
    line-height: 1.3;
  }

  :deep(p) {
    margin: 0.5em 0;
    line-height: 1.6;
  }

  :deep(ul), :deep(ol) {
    padding-left: 1.5em;
    margin: 0.5em 0;
  }

  :deep(li) {
    margin: 0.25em 0;
  }
}
</style>
