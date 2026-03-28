<template>
  <PageShell>
    <FsSection>
      <StorePageLayout :breadcrumbs="[{ label: 'Главная', to: '/' }, { label: 'Личный кабинет', to: '/account' }]" current="Профиль">

        <div class="profile-root">
          <FsForm class="form" @submit="onSave">
            <FsField label="Имя" required name="name" :model-value="name" :rules="[validationRules.name.required]" v-slot="{ hasError }">
              <FsInput v-model="name" placeholder="Ваше имя" :error="hasError" />
            </FsField>

            <FsField label="Телефон" name="phone" :model-value="phone" :rules="[validationRules.phone.format]" v-slot="{ hasError }">
              <FsInput v-model="phone" type="tel" placeholder="+7 (999) 123-45-67" mask="+7 (###) ###-##-##" :error="hasError" />
            </FsField>

            <FsField label="Email">
              <FsInput :model-value="authStore.customerEmail" disabled />
            </FsField>

            <FsAlert v-if="serverError" type="error">{{ serverError }}</FsAlert>
            <FsAlert v-if="saved" type="success">Сохранено</FsAlert>

            <FsButton type="submit" :disabled="loading">
              {{ loading ? 'Сохранение...' : 'Сохранить' }}
            </FsButton>
          </FsForm>
        </div>
      </StorePageLayout>
    </FsSection>
  </PageShell>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'no-services' })

import { ref, onMounted } from 'vue'
import { navigateTo } from 'nuxt/app'
import { FsSection, FsField, FsForm, FsInput, FsButton, FsAlert } from '@fastio/public-ui'
import { validationRules } from '@fastio/kit'
import PageShell from '~/components/sections/PageShell.vue'
import StorePageLayout from '~/components/layout/StorePageLayout.vue'
import { useAuthStore } from '~/stores/auth'
import { storeToRefs } from 'pinia'

const authStore = useAuthStore()
const { isAuthenticated } = storeToRefs(authStore)

const name = ref('')
const phone = ref('')
const serverError = ref('')
const loading = ref(false)
const saved = ref(false)

onMounted(async () => {
  await authStore.init()
  if (!isAuthenticated.value) {
    authStore.showLogin()
    navigateTo('/')
    return
  }
  name.value = authStore.customerName
  phone.value = authStore.customerPhone
})

async function onSave() {
  serverError.value = ''
  saved.value = false
  loading.value = true
  try {
    await authStore.updateProfile({ name: name.value, phone: phone.value })
    saved.value = true
  } catch (err: unknown) {
    const fetchErr = err as { data?: { message?: string } }
    serverError.value = fetchErr?.data?.message ?? 'Ошибка сохранения'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
.profile-root {
  max-width: 400px;
  margin: 0 auto;
}

.form {
  // gap handled by FsForm
}
</style>
