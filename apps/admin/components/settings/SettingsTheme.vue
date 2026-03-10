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
        <div class="logo-area">
          <img
            v-if="form.logoUrl"
            :src="form.logoUrl"
            class="logo-preview"
            alt="Логотип"
          />
          <span v-else class="logo-placeholder">Нет логотипа</span>
          <UiButton disabled>Загрузить (скоро)</UiButton>
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
import { UiForm, UiInput, UiSelect, UiButton, UiInputNumber, UiRadioGroup, UiSegmentedControl, useMessage } from '@fastio/ui'
import UiSectionHeader from '~/components/ui/SectionHeader.vue'
import type { Tenant, TenantTheme } from '@fastio/shared'
import { themePresets, fontOptions } from '~/config/theme-presets'

const props = defineProps<{ tenant: Tenant }>()
const emit = defineEmits<{ save: [data: Partial<Tenant>] }>()

const presets = themePresets

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
  preset: props.tenant.theme.preset === 'default' ? 'light' : (props.tenant.theme.preset ?? 'light'),
})

watch(() => props.tenant.theme, (t) => {
  Object.assign(form, {
    ...t,
    buttonRadius: t.buttonRadius ?? 'rounded',
    cardRadius: t.cardRadius ?? 14,
    cardShadow: t.cardShadow ?? 'subtle',
    preset: t.preset === 'default' ? 'light' : (t.preset ?? 'light'),
  })
})

const saving = ref(false)
const { success } = useMessage()

const handleSave = async () => {
  saving.value = true
  try {
    await emit('save', { theme: { ...form } })
    success('Сохранено')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@fastio/ui/styles/mixins/form' as *;
@use '@fastio/ui/styles/mixins/media-queries' as *;

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

.logo-area {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
  border: 1.5px dashed var(--color-border);
  border-radius: 10px;
}

.logo-preview {
  height: 48px;
  object-fit: contain;
  border-radius: 6px;
}

.logo-placeholder {
  font-size: 13px;
  color: var(--color-text-tertiary);
}

.footer {
  @include settings-footer;
}
</style>
