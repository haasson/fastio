<template>
  <div class="sections-root">

    <div class="group-label">Активные секции</div>

    <SectionSettingsRow label="Шапка">
      <HeaderOptions />
    </SectionSettingsRow>

    <template v-for="key in enabledKeys" :key="key">
      <SectionSettingsByKey
        :section-key="key"
        :form="siteLayoutForm"
        :content-form="form.contentForm"
        :pending-hero-bg="form.onPendingHeroBg"
        :pending-banners="form.onPendingBanners"
      />
    </template>

    <SectionSettingsRow label="Футер">
      <span class="coming-soon">Настройки футера появятся в ближайшее время</span>
    </SectionSettingsRow>

    <template v-if="disabledKeys.length">
      <div class="group-label group-label--mt">Неактивные секции</div>
      <template v-for="key in disabledKeys" :key="key">
        <SectionSettingsByKey
          :section-key="key"
          :form="siteLayoutForm"
          :content-form="form.contentForm"
          :pending-hero-bg="form.onPendingHeroBg"
          :pending-banners="form.onPendingBanners"
        />
      </template>
    </template>

  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import SectionSettingsRow from '~/components/appearance/SectionSettingsRow.vue'
import SectionSettingsByKey from '~/components/appearance/SectionSettingsByKey.vue'
import HeaderOptions from '~/components/appearance/HeaderOptions.vue'
import { SECTION_KEYS, type SectionKey } from '@fastio/shared'
import { AppearanceFormKey } from '~/composables/data/useAppearanceForm'

const form = inject(AppearanceFormKey)!
const siteLayoutForm = form.siteLayoutForm

const enabledKeys = computed(() => siteLayoutForm.sectionsOrder.filter((k) => SECTION_KEYS.includes(k as SectionKey)),
)

const disabledKeys = computed(() => SECTION_KEYS.filter((k) => !siteLayoutForm.sectionsOrder.includes(k)),
)
</script>

<style scoped lang="scss">
.sections-root {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.group-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-tertiary);
  padding: 16px 0 4px;

  &--mt {
    padding-top: 24px;
  }
}

.coming-soon {
  font-size: 13px;
  color: var(--color-text-tertiary);
}
</style>
