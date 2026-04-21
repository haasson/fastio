<template>
  <nav class="help-nav">
    <div class="help-search">
      <UiInput
        v-model:value="searchQuery"
        placeholder="Поиск…"
        clearable
      />
    </div>

    <UiSelect
      class="help-nav-mobile"
      :value="activeArticleId"
      :options="mobileOptions"
      placeholder="Выберите раздел…"
      @update:value="onMobileSelect"
    />

    <div class="help-nav-list">
      <template v-if="searchQuery.trim()">
        <NuxtLink
          v-for="article in searchResults"
          :key="article.id"
          :to="`/${article.sectionId}/${article.id}`"
          class="help-nav-article search-result"
          :class="{ active: activeArticleId === article.id }"
        >
          {{ article.title }}
        </NuxtLink>
        <div v-if="searchResults.length === 0" class="help-nav-empty">
          <UiText size="small" color="secondary">Ничего не найдено</UiText>
        </div>
      </template>

      <template v-else>
        <div
          v-for="section in KB_SECTIONS"
          :key="section.id"
          class="help-nav-section"
        >
          <NuxtLink
            :to="`/${section.id}/${section.articles[0].id}`"
            class="help-nav-section-title"
            :class="{ active: activeSectionId === section.id }"
          >
            <UiIcon :name="section.icon" :size="15" />
            <span>{{ section.title }}</span>
            <UiIcon
              name="chevronRight"
              :size="14"
              class="help-nav-chevron"
              :class="{ open: activeSectionId === section.id }"
            />
          </NuxtLink>

          <div v-if="activeSectionId === section.id && section.articles.length > 1" class="help-nav-articles">
            <NuxtLink
              v-for="article in section.articles"
              :key="article.id"
              :to="`/${section.id}/${article.id}`"
              class="help-nav-article"
              :class="{ active: activeArticleId === article.id }"
            >
              {{ article.title }}
            </NuxtLink>
          </div>
        </div>
      </template>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from '#imports'
import { UiInput, UiIcon, UiText, UiSelect } from '@fastio/ui'
import { KB_SECTIONS } from '~/config/kb'

const route = useRoute()
const router = useRouter()
const searchQuery = ref('')

const activeSectionId = computed(() => route.params.section as string || null)
const activeArticleId = computed(() => route.params.article as string || null)

const searchResults = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()

  if (!q) return []

  return KB_SECTIONS.flatMap((s) => s.articles
    .filter((a) => a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q))
    .map((a) => ({ ...a, sectionId: s.id })),
  )
})

const mobileOptions = computed(() => KB_SECTIONS.map((s) => ({
  type: 'group' as const,
  label: s.title,
  key: s.id,
  children: s.articles.map((a) => ({ label: a.title, value: a.id, sectionId: s.id })),
})),
)

function onMobileSelect(value: string | number | (string | number)[] | null) {
  if (typeof value !== 'string') return
  const section = KB_SECTIONS.find((s) => s.articles.some((a) => a.id === value))

  if (section) router.push(`/${section.id}/${value}`)
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as mq;
@use '@fastio/styles/mixins/layout' as *;

.help-nav-mobile {
  display: block;

  @include mq.mq-m {
    display: none;
  }
}

.help-nav {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);

  @include mq.mq-m {
    position: sticky;
    top: calc(56px + var(--space-32));
    max-height: calc(100vh - 56px - var(--space-32) * 2);
    overflow-y: auto;
  }
}

.help-search {
  width: 100%;
}

.help-nav-list {
  display: none;
  flex-direction: column;
  gap: 2px;

  @include mq.mq-m {
    display: flex;
  }
}

.help-nav-section {
  display: flex;
  flex-direction: column;
}

.help-nav-section-title {
  @include button-reset;
  @include flex-row(var(--space-8));

  padding: var(--space-8) var(--space-12);
  border-radius: var(--radius-8);
  text-align: left;
  width: 100%;
  color: var(--color-text);
  font-size: var(--font-size-md);
  text-decoration: none;
  transition: background var(--transition-fast), color var(--transition-fast);

  &:hover {
    background: var(--color-bg-hover);
  }

  &.active, &.router-link-active {
    color: var(--color-text);
    font-weight: var(--font-weight-medium);
  }
}

.help-nav-chevron {
  margin-left: auto;
  flex-shrink: 0;
  transition: transform var(--transition-fast);

  &.open {
    transform: rotate(90deg);
  }
}

.help-nav-articles {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 2px;
  margin-left: var(--space-20);
  padding-left: var(--space-12);
  border-left: 2px solid var(--color-border);
}

.help-nav-article {
  display: block;
  padding: var(--space-8) var(--space-12);
  border-radius: var(--radius-8);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  text-decoration: none;
  transition: background var(--transition-fast);

  &:hover {
    background: var(--color-bg-hover);
  }

  &.active, &.router-link-active {
    background: var(--color-primary-light);
    color: var(--color-primary);
    font-weight: var(--font-weight-medium);
  }

  &.search-result {
    font-size: var(--font-size-md);
  }
}

.help-nav-empty {
  padding: var(--space-8) var(--space-12);
}
</style>
