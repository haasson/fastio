<template>
  <FsSection as="footer" class="footer-root">
    <div class="footer-inner">
      <div class="footer-brand">
        <FsText variant="body" as="span" class="brand-name">{{ tenant?.name }}</FsText>
      </div>

      <div v-if="hasSocials" class="footer-links">
        <a
          v-if="tenant?.contacts?.instagram"
          :href="`https://instagram.com/${tenant.contacts.instagram}`"
          target="_blank"
          rel="noopener noreferrer"
          class="social-link"
          aria-label="Instagram"
        >
          <Instagram :size="20" />
        </a>
        <a
          v-if="tenant?.contacts?.telegram"
          :href="`https://t.me/${tenant.contacts.telegram}`"
          target="_blank"
          rel="noopener noreferrer"
          class="social-link"
          aria-label="Telegram"
        >
          <Send :size="20" />
        </a>
        <a
          v-if="tenant?.contacts?.vk"
          :href="`https://vk.com/${tenant.contacts.vk}`"
          target="_blank"
          rel="noopener noreferrer"
          class="social-link"
          aria-label="ВКонтакте"
        >
          <SfIconVk :size="20" />
        </a>
        <a
          v-if="tenant?.contacts?.whatsapp"
          :href="`https://wa.me/${tenant.contacts.whatsapp}`"
          target="_blank"
          rel="noopener noreferrer"
          class="social-link"
          aria-label="WhatsApp"
        >
          <SfIconWhatsapp :size="20" />
        </a>
        <a
          v-if="tenant?.contacts?.max"
          :href="`https://max.ru/j/${tenant.contacts.max}`"
          target="_blank"
          rel="noopener noreferrer"
          class="social-link"
          aria-label="MAX"
        >
          <SfIconMax :size="20" />
        </a>
      </div>

      <div v-if="tenant?.contacts?.phone || tenant?.workingHours" class="footer-contacts">
        <FsText v-if="tenant?.contacts?.phone" variant="body-sm">
          {{ tenant.contacts.phone }}
        </FsText>
        <FsText v-if="tenant?.workingHours" variant="body-sm" color="muted">
          {{ tenant.workingHours }}
        </FsText>
      </div>
    </div>

    <FsDivider />

    <div class="footer-bottom">
      <FsText variant="caption" color="muted" align="center">
        &copy; {{ year }} {{ tenant?.name }}. Сделано на FastIO
      </FsText>
    </div>
  </FsSection>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useNuxtData } from 'nuxt/app'
import type { Tenant } from '@fastio/shared'
import { Instagram, Send } from 'lucide-vue-next'
import SfIconVk from '~/components/sf/icons/SfIconVk.vue'
import SfIconWhatsapp from '~/components/sf/icons/SfIconWhatsapp.vue'
import SfIconMax from '~/components/sf/icons/SfIconMax.vue'
import { FsSection, FsText, FsDivider } from '@fastio/public-ui'

const { data: tenant } = useNuxtData<Tenant>('tenant')

const year = computed(() => new Date().getFullYear())

const hasSocials = computed(() => {
  const c = tenant.value?.contacts
  return !!(c?.instagram || c?.telegram || c?.vk || c?.whatsapp || c?.max)
})
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.footer-root {
  background: var(--color-surface);
}

.footer-inner {
  display: flex;
  flex-direction: column;
  gap: 24px;

  @include md {
    flex-direction: row;
    align-items: flex-start;
    gap: 40px;
  }
}

.footer-brand {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.brand-name {
  font-weight: 700;
}

.footer-links {
  display: flex;
  align-items: center;
  gap: 12px;
}

.social-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
  transition: color 0.15s;

  &:hover {
    color: var(--color-text);
  }
}

.footer-contacts {
  display: flex;
  flex-direction: column;
  gap: 4px;

  @include md {
    margin-left: auto;
    align-items: flex-end;
  }
}

.footer-bottom {
  display: flex;
  justify-content: center;
}
</style>
