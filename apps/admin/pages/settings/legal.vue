<template>
  <UiForm class="form" @submit.prevent="page.submit">
    <UiAlert v-if="!legalInfoComplete" type="warning">
      Заполните юридические данные — без них приём заказов и бронирование на витрине недоступны
    </UiAlert>

    <UiCard size="large" class="section">
      <UiSectionHeader title="Юридические данные" />

      <div class="grid">
        <UiInput
          v-model="form.legalName"
          label="Юридическое наименование *"
          placeholder="ИП Иванов Иван Иванович"
          name="legalName"
          :rules="[{ type: 'required', message: 'Введите наименование' }]"
        />
        <UiInput
          v-model="form.privacyEmail"
          label="Email для обращений по персданным *"
          placeholder="privacy@vasya-pizza.ru"
          name="privacyEmail"
          :rules="[
            { type: 'required', message: 'Введите email' },
            { type: 'email', message: 'Некорректный email' },
          ]"
        />
        <UiInput
          v-model="form.inn"
          label="ИНН *"
          placeholder="1234567890"
          name="inn"
          inputmode="numeric"
          :rules="[
            { type: 'required', message: 'Введите ИНН' },
            { type: 'pattern', pattern: /^\d{10}$|^\d{12}$/, message: 'ИНН — 10 цифр (ООО) или 12 цифр (ИП)' },
          ]"
        />
        <UiInput
          v-model="form.ogrn"
          label="ОГРН / ОГРНИП *"
          placeholder="1234567890123"
          name="ogrn"
          inputmode="numeric"
          :rules="[
            { type: 'required', message: 'Введите ОГРН или ОГРНИП' },
            { type: 'pattern', pattern: /^\d{13}$|^\d{15}$/, message: 'ОГРН — 13 цифр, ОГРНИП — 15 цифр' },
          ]"
        />
      </div>

      <UiInput
        v-model="form.legalAddress"
        label="Юридический адрес *"
        placeholder="117546, г. Москва, ул. Примерная, д. 1"
        name="legalAddress"
        :rules="[{ type: 'required', message: 'Введите адрес' }]"
      />
    </UiCard>

    <UiCard size="large" class="section">
      <UiSectionHeader title="Документы" />

      <div class="docs">
        <div class="doc-row">
          <span class="doc-label">Оферта для клиентов</span>
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
              :loading="uploading"
              tag="span"
            >
              {{ form.offerUrl ? 'Заменить' : 'Загрузить PDF' }}
            </UiButton>
            <input
              type="file"
              accept="application/pdf"
              class="file-input"
              @change="uploadOffer"
            />
          </label>
          <UiChipRemove
            v-if="form.offerUrl"
            :size="14"
            @click="form.offerUrl = null"
          />
        </div>
      </div>
    </UiCard>
  </UiForm>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { UiCard, UiForm, UiInput, UiButton, UiIcon, UiAlert, useMessage, UiSectionHeader, UiChipRemove } from '@fastio/ui'
import type { Tenant } from '@fastio/shared'
import { isLegalInfoComplete } from '@fastio/shared'
import { useTenantStore } from '~/shared/stores/tenant'
import { useDatabase } from '~/shared/data/useDatabase'
import { useEditableForm } from '~/shared/ui/composables/useEditableForm'
import { useRegisterPageForm } from '~/shared/ui/composables/usePageForm'
import { useUnsavedGuard } from '~/shared/ui/composables/useUnsavedGuard'
import { reportError } from '~/shared/utils/reportError'

const tenantStore = useTenantStore()
const db = useDatabase()
const { error } = useMessage()

const tenant = computed(() => tenantStore.tenant)

const page = useEditableForm({
  source: tenant,
  build: (t: Tenant) => ({
    legalName: t.legalInfo?.legalName ?? '',
    inn: t.legalInfo?.inn ?? '',
    ogrn: t.legalInfo?.ogrn ?? '',
    legalAddress: t.legalInfo?.legalAddress ?? '',
    privacyEmail: t.legalInfo?.privacyEmail ?? '',
    offerUrl: t.contacts?.offerUrl ?? null as string | null,
  }),
  save: (data) => tenantStore.update({
    legalInfo: {
      legalName: data.legalName,
      inn: data.inn,
      ogrn: data.ogrn,
      legalAddress: data.legalAddress,
      privacyEmail: data.privacyEmail,
    },
    contacts: {
      ...tenantStore.tenant.contacts,
      offerUrl: data.offerUrl,
    },
  }),
})

const { form } = page

useRegisterPageForm(page)
useUnsavedGuard(page.isDirty)

const legalInfoComplete = computed(() => isLegalInfoComplete({
  legalName: form.legalName,
  inn: form.inn,
  ogrn: form.ogrn,
  legalAddress: form.legalAddress,
  privacyEmail: form.privacyEmail,
}))

const uploading = ref(false)

const uploadOffer = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]

  if (!file) return
  uploading.value = true
  try {
    form.offerUrl = await db.tenants.uploadDocument(tenantStore.tenant.id, file, 'offer')
  } catch (e) {
    reportError(e, { context: 'settings/legal:uploadOffer', tenantId: tenantStore.tenant.id })
    error('Ошибка загрузки файла')
  } finally {
    uploading.value = false
    ;(event.target as HTMLInputElement).value = ''
  }
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;
@use '@fastio/styles/mixins/media-queries' as *;

.form {
  @include flex-col(var(--space-12));
  max-width: 680px;
}

.section {
  gap: var(--space-16);
}

.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-12);

  @include mq-m {
    grid-template-columns: 1fr 1fr;
  }
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

</style>
