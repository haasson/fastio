<template>
  <UiForm ref="formRef" class="form" @submit.prevent="page.submit">
    <UiAlert v-if="!legalInfoComplete" type="warning">
      Заполните юридические данные — без них приём заказов и бронирование на витрине недоступны
    </UiAlert>

    <UiFormSection title="Юридические данные" :columns="2">
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
      <UiInput
        v-model="form.legalAddress"
        class="span-2"
        label="Юридический адрес *"
        placeholder="117546, г. Москва, ул. Примерная, д. 1"
        name="legalAddress"
        :rules="[{ type: 'required', message: 'Введите адрес' }]"
      />
    </UiFormSection>

    <UiFormSection title="Документы" :columns="1">
      <UiSettingRow label="Оферта для клиентов">
        <template #control>
          <div class="doc-actions">
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
        </template>
      </UiSettingRow>
    </UiFormSection>
  </UiForm>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { UiForm, UiFormSection, UiSettingRow, UiInput, UiButton, UiIcon, UiAlert, useMessage, UiChipRemove } from '@fastio/ui'
import type { Tenant } from '@fastio/shared'
import { isLegalInfoComplete } from '@fastio/shared'
import { useTenantStore } from '~/shared/stores/tenant'
import { useDatabase } from '~/shared/data/useDatabase'
import { useEditableForm } from '~/shared/ui/composables/useEditableForm'
import { useRegisterPageForm } from '~/shared/ui/composables/usePageForm'
import { useUnsavedGuard } from '~/shared/ui/composables/useUnsavedGuard'
import { reportError } from '@fastio/shared/observability'

const tenantStore = useTenantStore()
const db = useDatabase()
const { error } = useMessage()

const tenant = computed(() => tenantStore.tenant)

const formRef = ref<{ validate: () => boolean } | null>(null)

const page = useEditableForm({
  source: tenant,
  validate: () => formRef.value?.validate() ?? true,
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
  max-width: 720px;
}

.span-2 {
  @include mq-m {
    grid-column: 1 / -1;
  }
}

.doc-actions {
  @include flex-row(var(--space-12));
  flex-wrap: wrap;
  align-items: center;
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
