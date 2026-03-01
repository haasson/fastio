<template>
  <form class="form" @submit.prevent="handleSave">
    <h3 class="section-title">Тема оформления</h3>

    <div class="presets">
      <button
        v-for="preset in presets"
        :key="preset.value"
        type="button"
        class="preset"
        :class="{ selected: form.preset === preset.value }"
        :style="{ '--preset-color': preset.color }"
        @click="selectPreset(preset)"
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
        <input v-model="form.primaryColor" class="input color-input" type="text" placeholder="#ff6b35" />
        <div class="color-preview" :style="{ background: form.primaryColor }" />
      </div>
    </div>

    <div class="field">
      <label class="label">Шрифт</label>
      <select v-model="form.fontFamily" class="input select">
        <option v-for="font in fonts" :key="font.value" :value="font.value">
          {{ font.label }}
        </option>
      </select>
    </div>

    <div class="field">
      <label class="label">Логотип</label>
      <div class="logo-area">
        <img v-if="form.logoUrl" :src="form.logoUrl" class="logo-preview" alt="Логотип" />
        <span v-else class="logo-placeholder">Нет логотипа</span>
        <button type="button" class="btn-ghost">
          📎 Загрузить (скоро)
        </button>
      </div>
    </div>

    <div class="footer">
      <span v-if="saved" class="saved-msg">✅ Сохранено</span>
      <button type="submit" class="btn-primary" :disabled="saving">
        {{ saving ? 'Сохранение…' : 'Сохранить' }}
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
import type { Tenant, TenantTheme } from '@fastfood-saas/shared'

const props = defineProps<{ tenant: Tenant }>()
const emit = defineEmits<{ save: [data: Partial<Tenant>] }>()

const presets: { value: TenantTheme['preset']; label: string; color: string }[] = [
  { value: 'default', label: 'Оранжевый', color: '#ff6b35' },
  { value: 'dark', label: 'Тёмный', color: '#1a1a2e' },
  { value: 'warm', label: 'Красный', color: '#dc2626' },
  { value: 'minimal', label: 'Минимал', color: '#111111' },
]

const fonts = [
  { value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', label: 'Системный (по умолчанию)' },
  { value: '"Inter", sans-serif', label: 'Inter' },
  { value: '"Nunito", sans-serif', label: 'Nunito' },
  { value: '"Montserrat", sans-serif', label: 'Montserrat' },
]

const form = reactive<TenantTheme>({ ...props.tenant.theme })

watch(() => props.tenant.theme, (t) => { Object.assign(form, t) })

function selectPreset(preset: (typeof presets)[number]) {
  form.preset = preset.value
  form.primaryColor = preset.color
}

const saving = ref(false)
const saved = ref(false)

async function handleSave() {
  saving.value = true
  saved.value = false
  try {
    await emit('save', { theme: { ...form } })
    saved.value = true
    setTimeout(() => { saved.value = false }, 3000)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.form { display: flex; flex-direction: column; gap: 20px; }

.section-title {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #aaa;
}

/* Пресеты */
.presets {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.preset {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 8px;
  border: 2px solid #f0f0f0;
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  transition: border-color 0.15s;
  position: relative;
}

.preset:hover { border-color: #ddd; }
.preset.selected { border-color: var(--preset-color); }

.preset-swatch {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--preset-color);
}

.preset-name {
  font-size: 11px;
  font-weight: 600;
  color: #555;
}

.preset-check {
  position: absolute;
  top: 6px;
  right: 8px;
  font-size: 11px;
  color: var(--preset-color);
  font-weight: 800;
}

/* Цвет */
.field { display: flex; flex-direction: column; gap: 6px; }
.label { font-size: 13px; font-weight: 600; color: #555; }

.color-row { display: flex; align-items: center; gap: 10px; }

.color-picker {
  width: 42px;
  height: 42px;
  border: none;
  border-radius: 10px;
  padding: 2px;
  cursor: pointer;
}

.color-input { flex: 1; }

.color-preview {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  flex-shrink: 0;
  border: 1px solid rgba(0,0,0,0.08);
}

.input {
  height: 42px;
  border: 1.5px solid #e0e0e0;
  border-radius: 10px;
  padding: 0 12px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
  background: #fff;
}

.input:focus { border-color: #ff6b35; }
.select { cursor: pointer; }

/* Логотип */
.logo-area {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
  border: 1.5px dashed #e0e0e0;
  border-radius: 10px;
}

.logo-preview {
  height: 48px;
  object-fit: contain;
  border-radius: 6px;
}

.logo-placeholder {
  font-size: 13px;
  color: #bbb;
}

.btn-ghost {
  background: transparent;
  border: 1.5px solid #e0e0e0;
  border-radius: 8px;
  height: 34px;
  padding: 0 12px;
  font-size: 13px;
  color: #888;
  cursor: not-allowed;
  opacity: 0.6;
}

/* Footer */
.footer { display: flex; align-items: center; justify-content: flex-end; gap: 12px; }
.saved-msg { font-size: 13px; color: #10b981; }

.btn-primary {
  height: 40px;
  padding: 0 20px;
  background: #ff6b35;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
}

.btn-primary:hover:not(:disabled) { background: #e55a25; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

@media (max-width: 480px) { .presets { grid-template-columns: repeat(2, 1fr); } }
</style>
