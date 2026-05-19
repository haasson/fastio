<template>
  <div class="suspended-root">
    <div class="suspended-card">
      <div class="suspended-icon">
        <PauseCircle :size="56" />
      </div>

      <FsHeading as="h1" size="h3" align="center" class="suspended-title">
        Заведение временно недоступно
      </FsHeading>

      <FsText as="p" variant="body" color="secondary" align="center" class="suspended-desc">
        Сайт приостановлен владельцем заведения. Скорее всего, это временно — мы вернёмся в строй, как только администрация разберётся с биллингом.
      </FsText>

      <div class="suspended-actions">
        <FsText as="p" variant="body-sm" color="muted" align="center">
          Если вы владелец заведения — войдите в админ-панель FastIO и продлите подписку.
        </FsText>
        <a class="support-link" href="https://t.me/fastio_ru" target="_blank" rel="noopener noreferrer">
          <Send :size="16" />
          Связаться с поддержкой FastIO
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useHead } from 'nuxt/app'
import { PauseCircle, Send } from 'lucide-vue-next'
import { FsText, FsHeading } from '@fastio/public-ui'

// Страница доступна всегда, даже когда tenant suspended — она и есть посадочная
// для редиректа из middleware/suspended.global.ts. Layout отключаем, чтобы не
// тянуть SiteHeader/Footer с branch-pickers и прочей логикой, которая может
// упасть на suspended-тенанте.
definePageMeta({
  layout: false,
})

useHead({
  title: 'Заведение временно недоступно',
  meta: [
    { name: 'robots', content: 'noindex,nofollow' },
  ],
})
</script>

<style scoped lang="scss">
.suspended-root {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--color-bg);
}

.suspended-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  max-width: 480px;
  width: 100%;
  padding: 32px 24px;
  background: var(--color-surface);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
}

.suspended-icon {
  color: var(--color-text-muted);
  opacity: 0.6;
}

.suspended-title {
  margin: 0;
}

.suspended-desc {
  max-width: 360px;
  margin: 0;
}

.suspended-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
  width: 100%;
}

.support-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: var(--radius-btn);
  background: var(--primary);
  color: var(--on-primary);
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.9;
  }
}
</style>
