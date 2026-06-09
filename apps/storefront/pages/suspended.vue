<template>
  <div class="suspended-root">
    <div class="suspended-card">
      <div class="suspended-icon">
        <Clock :size="56" />
      </div>

      <FsText v-if="venueName" as="p" variant="body-sm" color="muted" align="center" class="suspended-kicker">
        {{ venueName }}
      </FsText>

      <FsHeading as="h1" size="h3" align="center" class="suspended-title">
        Временно недоступно
      </FsHeading>

      <FsText as="p" variant="body" color="secondary" align="center" class="suspended-desc">
        Извините, сейчас мы не принимаем онлайн-заказы. Скоро вернёмся — загляните позже{{ phone ? ' или свяжитесь с нами по телефону' : '' }}.
      </FsText>

      <a v-if="phone" class="phone-link" :href="telHref">
        <Phone :size="16" />
        {{ phone }}
      </a>

      <div class="owner-note">
        <FsText as="p" variant="caption" color="muted" align="center">
          Владельцу заведения: чтобы возобновить работу сайта, напишите в поддержку FastIO —
          <a href="https://t.me/fastio_ru" target="_blank" rel="noopener noreferrer">@fastio_ru</a>
          или
          <a href="mailto:support@fastio.ru">support@fastio.ru</a>
        </FsText>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useHead, useNuxtData, navigateTo } from 'nuxt/app'
import { Clock, Phone } from 'lucide-vue-next'
import { FsText, FsHeading } from '@fastio/public-ui'
import type { Tenant } from '@fastio/shared'

// Страница доступна всегда, даже когда tenant suspended — она и есть посадочная
// для редиректа из middleware/suspended.global.ts. Layout отключаем, чтобы не
// тянуть SiteHeader/Footer с branch-pickers и прочей логикой, которая может
// упасть на suspended-тенанте.
definePageMeta({
  layout: false,
})

// tenant уже в кэше (app.vue фетчит через useAsyncData('tenant')). Берём имя и
// телефон, чтобы экран говорил от лица заведения. Всё опционально — если кэш
// пуст, показываем нейтральный текст без падений.
const { data: tenant } = useNuxtData<Tenant>('tenant')

// /suspended в вайтлисте middleware, поэтому сам по себе не редиректит обратно.
// Если тенант уже НЕ заблокирован (оплатил → status свежий на каждом запросе,
// см. server/utils/tenantCache) — уводим на главную. Иначе рефреш не помогал бы.
// На SSR navigateTo в setup = серверный редирект, так что работает и при F5.
const status = tenant.value?.subscription?.status
if (status && status !== 'suspended') {
  await navigateTo('/', { replace: true })
}
const venueName = computed(() => tenant.value?.name?.trim() ?? '')
const phone = computed(() => tenant.value?.contacts?.phone?.trim() ?? '')
const telHref = computed(() => `tel:${phone.value.replace(/[^+\d]/g, '')}`)

useHead({
  title: 'Временно недоступно',
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

.suspended-kicker {
  margin: 0 0 -8px;
  font-weight: 600;
}

.suspended-title {
  margin: 0;
}

.suspended-desc {
  max-width: 360px;
  margin: 0;
}

.phone-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: var(--radius-btn);
  background: var(--primary);
  color: var(--on-primary);
  font-size: 15px;
  font-weight: 600;
  text-decoration: none;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.9;
  }
}

.owner-note {
  margin-top: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
  width: 100%;

  a {
    color: var(--color-text-secondary);
    text-decoration: underline;
  }
}
</style>
