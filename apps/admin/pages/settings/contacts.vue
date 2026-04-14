<template>
  <UiForm class="form" @submit="handleSave">
    <UiSectionHeader title="Основное" />

    <div class="grid">
      <UiInput
        v-model="form.name"
        name="name"
        label="Название заведения *"
        placeholder="Пицца Васи"
        :rules="[{ type: 'required', message: 'Введите название' }]"
      />
      <UiInput v-model="form.email" label="Email" placeholder="info@vasya-pizza.ru" />
    </div>

    <UiInput
      v-model="form.phone"
      name="phone"
      label="Телефон"
      class="phone-input"
      placeholder="+7 (999) 000-00-00"
      :rules="[{ type: 'phone', message: 'Введите корректный телефон' }]"
    />

    <UiSelect
      v-model:value="form.timezone"
      label="Часовой пояс"
      :options="TIMEZONE_OPTIONS"
      filterable
      class="timezone-select"
    />

    <UiSectionHeader title="Часы работы" />

    <WorkingHoursEditor v-model="form.workingHoursSchedule" />

    <UiSectionHeader title="Соцсети и мессенджеры" />

    <div class="grid">
      <UiInput v-model="form.instagram" label="Instagram" placeholder="@vasya_pizza" />
      <UiInput v-model="form.vk" label="ВКонтакте" placeholder="vk.com/vasya_pizza" />
      <UiInput v-model="form.telegram" label="Telegram" placeholder="@vasya_pizza" />
      <UiInput v-model="form.whatsapp" label="WhatsApp" placeholder="+7 (999) 000-00-00" />
      <UiInput v-model="form.max" label="MAX" placeholder="@vasya_pizza" />
    </div>

    <UiSectionHeader title="Документы" />

    <div class="docs">
      <div class="doc-row">
        <span class="doc-label">Политика конфиденциальности</span>
        <a
          v-if="form.privacyUrl"
          :href="form.privacyUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="doc-link"
        >
          <UiIcon name="fileText" :size="14" />
          PDF прикреплён
        </a>
        <label class="doc-upload">
          <UiButton
            type="default"
            size="small"
            :loading="uploading.privacy"
            tag="span"
          >
            {{ form.privacyUrl ? 'Заменить' : 'Загрузить PDF' }}
          </UiButton>
          <input
            type="file"
            accept="application/pdf"
            class="file-input"
            @change="uploadDoc('privacy', $event)"
          />
        </label>
        <button
          v-if="form.privacyUrl"
          type="button"
          class="doc-remove"
          @click="form.privacyUrl = null"
        >
          <UiIcon name="close" :size="14" />
        </button>
      </div>

      <div class="doc-row">
        <span class="doc-label">Оферта</span>
        <a
          v-if="form.offerUrl"
          :href="form.offerUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="doc-link"
        >
          <UiIcon name="fileText" :size="14" />
          PDF прикреплён
        </a>
        <label class="doc-upload">
          <UiButton
            type="default"
            size="small"
            :loading="uploading.offer"
            tag="span"
          >
            {{ form.offerUrl ? 'Заменить' : 'Загрузить PDF' }}
          </UiButton>
          <input
            type="file"
            accept="application/pdf"
            class="file-input"
            @change="uploadDoc('offer', $event)"
          />
        </label>
        <button
          v-if="form.offerUrl"
          type="button"
          class="doc-remove"
          @click="form.offerUrl = null"
        >
          <UiIcon name="close" :size="14" />
        </button>
      </div>
    </div>

    <div class="footer">
      <UiButton submit type="primary" :loading="saving">Сохранить</UiButton>
    </div>
  </UiForm>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { UiForm, UiInput, UiButton, UiIcon, useMessage, UiSectionHeader, UiSelect } from '@fastio/ui'
import type { Tenant, WorkingHoursSchedule } from '@fastio/shared'
import { TIMEZONE_OPTIONS } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useDatabase } from '~/composables/data/useDatabase'
import WorkingHoursEditor from '~/components/settings/WorkingHoursEditor.vue'

const tenantStore = useTenantStore()
const db = useDatabase()

const DEFAULT_SCHEDULE: WorkingHoursSchedule = { default: { open: '10:00', close: '22:00' }, days: {} }

const buildForm = (t: Tenant) => ({
  name: t.name ?? '',
  phone: t.contacts?.phone ?? '',
  email: t.contacts?.email ?? '',
  instagram: t.contacts?.instagram ?? '',
  vk: t.contacts?.vk ?? '',
  telegram: t.contacts?.telegram ?? '',
  whatsapp: t.contacts?.whatsapp ?? '',
  max: t.contacts?.max ?? '',
  privacyUrl: t.contacts?.privacyUrl ?? null,
  offerUrl: t.contacts?.offerUrl ?? null,
  timezone: t.timezone ?? 'Europe/Moscow',
  workingHoursSchedule: t.workingHoursSchedule ?? DEFAULT_SCHEDULE,
})

const form = reactive(buildForm(tenantStore.tenant!))

watch(() => tenantStore.tenant, (t) => {
  if (t) Object.assign(form, buildForm(t))
})

const saving = ref(false)
const uploading = reactive({ privacy: false, offer: false })
const { success, error } = useMessage()

const uploadDoc = async (slug: 'privacy' | 'offer', event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]

  if (!file) return

  uploading[slug] = true
  try {
    const url = await db.tenants.uploadDocument(tenantStore.tenant!.id, file, slug)

    if (slug === 'privacy') form.privacyUrl = url
    else form.offerUrl = url
  } catch {
    error('Ошибка загрузки файла')
  } finally {
    uploading[slug] = false
    ;(event.target as HTMLInputElement).value = ''
  }
}

const handleSave = async () => {
  saving.value = true
  try {
    await tenantStore.update({
      name: form.name,
      timezone: form.timezone,
      contacts: {
        phone: form.phone,
        email: form.email,
        address: '',
        instagram: form.instagram || null,
        vk: form.vk || null,
        telegram: form.telegram || null,
        whatsapp: form.whatsapp || null,
        max: form.max || null,
        privacyUrl: form.privacyUrl,
        offerUrl: form.offerUrl,
      },
      workingHoursSchedule: form.workingHoursSchedule,
    })
    success('Сохранено')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/form' as *;
@use '@fastio/styles/mixins/layout' as *;
@use '@fastio/styles/mixins/media-queries' as *;

.form {
  @include flex-col(var(--space-20));
  max-width: 680px;
}

.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-12);

  @include mq-m {
    grid-template-columns: 1fr 1fr;
  }
}

.phone-input {
  max-width: 320px;
}

.timezone-select {
  max-width: 320px;
}

.docs {
  @include flex-col;
}

.doc-row {
  @include flex-row;
  flex-wrap: wrap;
}

.doc-label {
  font-size: var(--font-size-md);
  color: var(--color-text);
  min-width: 220px;
}

.doc-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-4);
  font-size: var(--font-size-base);
  color: var(--color-primary);
  text-decoration: none;

  &:hover { text-decoration: underline; }
}

.doc-upload {
  display: inline-flex;
  cursor: pointer;
}

.file-input {
  display: none;
}

.doc-remove {
  border: none;
  background: none;
  cursor: pointer;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  padding: var(--space-4);
  border-radius: var(--radius-4);

  &:hover { color: var(--color-danger); }
}

.footer {
  @include settings-footer;
}
</style>
