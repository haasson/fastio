<template>
  <UiForm @submit="handleSave">
    <div class="form">
      <UiSectionHeader title="Тема оформления" />

      <div class="presets">
        <button
          v-for="preset in presets"
          :key="preset.value"
          type="button"
          class="preset"
          :class="{ selected: form.preset === preset.value }"
          :style="{ '--preset-color': preset.preview }"
          @click="form.preset = preset.value"
        >
          <span class="preset-swatch" />
          <span class="preset-name">{{ preset.label }}</span>
          <span v-if="form.preset === preset.value" class="preset-check">✓</span>
        </button>
      </div>

      <div class="field">
        <label class="label">Лейаут сайта</label>
        <div class="layouts">
          <button
            v-for="opt in layoutOptions"
            :key="opt.value"
            type="button"
            class="layout-card"
            :class="{ selected: form.layout === opt.value }"
            @click="form.layout = opt.value"
          >
            <div class="layout-preview">
              <UiIcon :name="opt.icon" :size="28" />
            </div>
            <span class="layout-name">{{ opt.label }}</span>
            <span class="layout-desc">{{ opt.desc }}</span>
            <span v-if="form.layout === opt.value" class="layout-check">✓</span>
          </button>
        </div>
      </div>

      <div class="field">
        <label class="label">Основной цвет</label>
        <div class="color-row">
          <input v-model="form.primaryColor" class="color-picker" type="color" />
          <UiInput
            v-model="form.primaryColor"
            name="primaryColor"
            placeholder="#ff6b35"
            :clearable="false"
            :rules="[{ type: 'pattern', pattern: /^#[0-9a-fA-F]{6}$/, message: 'Формат: #RRGGBB' }]"
          />
          <div class="color-preview" :style="{ background: form.primaryColor }" />
        </div>
      </div>

      <UiSelect v-model:value="form.fontFamily" :options="fontOptions" label="Шрифт" />

      <div class="field">
        <label class="label">Стиль кнопок</label>
        <UiSegmentedControl
          v-model="form.buttonRadius"
          :items="buttonRadiusOptions"
        />
      </div>

      <UiInputNumber
        v-model="form.cardRadius"
        label="Радиус карточек (px)"
        :min="8"
        :max="24"
        :show-button="true"
      />

      <div class="field">
        <label class="label">Тени карточек</label>
        <UiRadioGroup
          v-model="form.cardShadow"
          :options="cardShadowOptions"
        />
      </div>

      <div class="field">
        <label class="label">Логотип</label>
        <div class="logo-upload">
          <PhotoUpload
            v-model="form.logoUrl"
            @pending="pendingLogoFile = $event"
          />
        </div>
      </div>

      <div class="footer">
        <UiButton submit type="primary" :loading="saving">Сохранить</UiButton>
      </div>
    </div>
  </UiForm>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { UiForm, UiInput, UiSelect, UiButton, UiInputNumber, UiRadioGroup, UiSegmentedControl, UiIcon, useMessage } from '@fastio/ui'
import UiSectionHeader from '~/components/ui/SectionHeader.vue'
import PhotoUpload from '~/components/ui/PhotoUpload.vue'
import type { Tenant, TenantTheme } from '@fastio/shared'
import { themePresets, fontOptions } from '~/config/theme-presets'
import { useDatabase } from '~/composables/data/useDatabase'

const props = defineProps<{ tenant: Tenant }>()
const emit = defineEmits<{ save: [data: Partial<Tenant>] }>()

const presets = themePresets

const layoutOptions = [
  { value: 'multipage', label: 'Мультистраничный', desc: 'Каждая категория — отдельная страница', icon: 'layoutGrid' },
  { value: 'menu', label: 'Меню', desc: 'Все блюда на одной странице со скроллом', icon: 'list' },
] as const

const buttonRadiusOptions = [
  { value: 'square', label: 'Квадратные' },
  { value: 'rounded', label: 'Скруглённые' },
  { value: 'pill', label: 'Пилюля' },
]

const cardShadowOptions = [
  { value: 'none', label: 'Без теней' },
  { value: 'subtle', label: 'Лёгкие' },
  { value: 'medium', label: 'Средние' },
]

const form = reactive<TenantTheme>({
  ...props.tenant.theme,
  buttonRadius: props.tenant.theme.buttonRadius ?? 'rounded',
  cardRadius: props.tenant.theme.cardRadius ?? 14,
  cardShadow: props.tenant.theme.cardShadow ?? 'subtle',
  layout: props.tenant.theme.layout ?? 'multipage',
  preset: props.tenant.theme.preset ?? 'fresh',
})

watch(() => props.tenant.theme, (t) => {
  Object.assign(form, {
    ...t,
    buttonRadius: t.buttonRadius ?? 'rounded',
    cardRadius: t.cardRadius ?? 14,
    cardShadow: t.cardShadow ?? 'subtle',
    layout: t.layout ?? 'multipage',
    preset: t.preset ?? 'fresh',
  })
})

const saving = ref(false)
const pendingLogoFile = ref<File | null>(null)
const { success } = useMessage()
const db = useDatabase()

const handleSave = async () => {
  saving.value = true
  try {
    if (pendingLogoFile.value) {
      form.logoUrl = await db.tenants.uploadLogo(props.tenant.id, pendingLogoFile.value)
      pendingLogoFile.value = null
    }
    await emit('save', { theme: { ...form } })
    success('Сохранено')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/form' as *;
@use '@fastio/styles/mixins/media-queries' as *;

.form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.presets {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;

  @include mq-m {
    grid-template-columns: repeat(4, 1fr);
  }
}

.preset {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 8px;
  border: 2px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-bg-card);
  cursor: pointer;
  transition: border-color 0.15s;
  position: relative;

  &:hover {
    border-color: var(--color-text-tertiary);
  }

  &.selected {
    border-color: var(--color-primary);
  }
}

.preset-swatch {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--preset-color);
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.preset-name {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-hint);
}

.preset-check {
  position: absolute;
  top: 6px;
  right: 8px;
  font-size: 11px;
  color: var(--color-primary);
  font-weight: 800;
}

.layouts {
  display: flex;
  gap: 10px;
}

.layout-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 12px;
  border: 2px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-bg-card);
  cursor: pointer;
  transition: border-color 0.15s;
  position: relative;
  text-align: left;

  &:hover {
    border-color: var(--color-text-tertiary);
  }

  &.selected {
    border-color: var(--color-primary);
  }
}

.layout-preview {
  color: var(--color-text-hint);
  margin-bottom: 4px;
}

.layout-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}

.layout-desc {
  font-size: 11px;
  color: var(--color-text-hint);
  line-height: 1.4;
}

.layout-check {
  position: absolute;
  top: 8px;
  right: 10px;
  font-size: 11px;
  color: var(--color-primary);
  font-weight: 800;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-hint);
}

.color-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.color-picker {
  width: 42px;
  height: 42px;
  border: none;
  border-radius: 10px;
  padding: 2px;
  cursor: pointer;
  flex-shrink: 0;
}

.color-preview {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  flex-shrink: 0;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.logo-upload {
  max-width: 240px;
}

.footer {
  @include settings-footer;
}
</style>
