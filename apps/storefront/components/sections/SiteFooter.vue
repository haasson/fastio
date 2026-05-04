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

      <div v-if="branches.length > 1" class="footer-branches">
        <div v-for="branch in branches" :key="branch.id" class="footer-branch">
          <FsText variant="body-sm" class="branch-name">{{ branch.name }}</FsText>
          <FsText variant="caption" color="secondary">{{ formatBranchAddressShort(branch) }}</FsText>
          <a v-if="branch.phone" class="branch-phone" :href="`tel:${branch.phone}`">{{ branch.phone }}</a>
          <FsText v-if="branch.workingHoursSchedule" variant="caption" color="secondary">
            {{ formatWorkingHours(branch.workingHoursSchedule) }}
          </FsText>
        </div>
      </div>

      <div v-else-if="tenant?.contacts?.phone || formattedHours" class="footer-contacts">
        <FsText v-if="tenant?.contacts?.phone" variant="body-sm">
          {{ tenant.contacts.phone }}
        </FsText>
        <FsText v-if="formattedHours" variant="body-sm" color="secondary">
          {{ formattedHours }}
        </FsText>
      </div>
    </div>

    <div v-if="hasDocuments" class="footer-docs">
      <NuxtLink v-if="hasPrivacy" to="/privacy" target="_blank" class="doc-link">
        Политика конфиденциальности
      </NuxtLink>
      <a v-if="offerUrl" :href="offerUrl" target="_blank" rel="noopener noreferrer" class="doc-link">
        Оферта
      </a>
    </div>

    <FsDivider />

    <div class="footer-bottom">
      <FsText variant="caption" color="muted" align="center">
        &copy; {{ year }} {{ tenant?.name }}. Сделано в
        <a href="https://fastio.ru" target="_blank" rel="noopener noreferrer" class="fastio-link">fastio.ru</a>
      </FsText>
    </div>
  </FsSection>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useNuxtData } from 'nuxt/app'
import { NuxtLink } from '#components'
import type { BranchPublic, Tenant } from '@fastio/shared'
import { formatWorkingHours, formatBranchAddressShort, isLegalInfoComplete } from '@fastio/shared'
import { Instagram, Send } from 'lucide-vue-next'
import SfIconVk from '~/components/sf/icons/SfIconVk.vue'
import SfIconWhatsapp from '~/components/sf/icons/SfIconWhatsapp.vue'
import SfIconMax from '~/components/sf/icons/SfIconMax.vue'
import { FsSection, FsText, FsDivider } from '@fastio/public-ui'

const { data: tenant } = useNuxtData<Tenant>('tenant')

const year = computed(() => new Date().getFullYear())
const formattedHours = computed(() => formatWorkingHours(tenant.value?.workingHoursSchedule))

const branches = ref<BranchPublic[]>([])

const hasPrivacy = computed(() => isLegalInfoComplete(tenant.value?.legalInfo))
const offerUrl = computed(() => tenant.value?.contacts?.offerUrl ?? null)
const hasDocuments = computed(() => hasPrivacy.value || !!offerUrl.value)

onMounted(async () => {
  try {
    branches.value = await $fetch<BranchPublic[]>('/api/branches')
  } catch { /* silent */ }
})

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
  @include flex-col(24px);

  @include md {
    flex-direction: row;
    align-items: flex-start;
    gap: 40px;
  }
}

.footer-brand {
  @include flex-col(4px);
}

.brand-name {
  font-weight: 700;
}

.footer-links {
  @include flex-row(12px);
}

.social-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  text-decoration: none;
  @include text-xs(600);
  transition: color 0.15s;

  &:hover {
    color: var(--color-text);
  }
}

.footer-branches {
  @include flex-col(16px);

  @include md {
    margin-left: auto;
    align-items: flex-end;
  }
}

.footer-branch {
  @include flex-col(2px);

  @include md {
    align-items: flex-end;
  }
}

.branch-name {
  font-weight: 600;
}

.branch-phone {
  @include text-xs;
  color: var(--color-text);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.footer-contacts {
  @include flex-col(4px);

  @include md {
    margin-left: auto;
    align-items: flex-end;
  }
}

.footer-docs {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
  justify-content: center;
}

.doc-link {
  font-size: 12px;
  color: var(--color-text-secondary);
  text-decoration: none;

  &:hover {
    color: var(--color-text);
    text-decoration: underline;
  }
}

.footer-bottom {
  display: flex;
  justify-content: center;
}

.fastio-link {
  color: inherit;
  text-decoration: underline;
  text-decoration-color: var(--color-border);
  text-underline-offset: 2px;
  transition: color 0.15s;

  &:hover {
    color: var(--color-text);
  }
}
</style>
