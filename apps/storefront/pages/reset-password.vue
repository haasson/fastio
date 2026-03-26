<template>
  <PageShell>
    <FsSection>
      <StorePageLayout :breadcrumbs="[{ label: 'Главная', to: '/' }]" current="Новый пароль">

        <div class="reset-root">
          <FsForm v-if="!done" class="form" @submit="onSubmit">
            <FsField label="Новый пароль" required name="password" :model-value="password" :rules="[validationRules.password.required, validationRules.password.minLength]" v-slot="{ hasError }">
              <FsInput v-model="password" type="password" placeholder="Минимум 6 символов" :error="hasError" />
            </FsField>

            <FsField label="Подтвердите пароль" required name="confirmPassword" :model-value="confirmPassword" :rules="[validationRules.password.required, { type: 'custom', validator: (v) => v === password.value, message: 'Пароли не совпадают' }]" v-slot="{ hasError }">
              <FsInput v-model="confirmPassword" type="password" placeholder="Ещё раз" :error="hasError" />
            </FsField>

            <FsAlert v-if="serverError" type="error">{{ serverError }}</FsAlert>

            <FsButton type="submit" :disabled="loading" block>
              {{ loading ? 'Сохранение...' : 'Сохранить пароль' }}
            </FsButton>
          </FsForm>

          <div v-else class="success">
            <FsText>Пароль успешно изменён. Теперь вы можете войти с новым паролем.</FsText>
            <FsButton block @click="navigateTo('/')">
              На главную
            </FsButton>
          </div>
        </div>
      </StorePageLayout>
    </FsSection>
  </PageShell>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { navigateTo } from 'nuxt/app'
import { FsSection, FsField, FsForm, FsInput, FsButton, FsText, FsAlert } from '@fastio/public-ui'
import { validationRules } from '@fastio/kit'
import PageShell from '~/components/sections/PageShell.vue'
import StorePageLayout from '~/components/layout/StorePageLayout.vue'
import { useSupabaseClient } from '~/composables/useSupabaseClient'

const password = ref('')
const confirmPassword = ref('')
const serverError = ref('')
const loading = ref(false)
const done = ref(false)

onMounted(async () => {
  const supabase = useSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    serverError.value = 'Ссылка недействительна или истекла'
  }
})

async function onSubmit() {
  serverError.value = ''
  loading.value = true
  try {
    const supabase = useSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    await $fetch('/api/auth/reset-password', {
      method: 'POST',
      body: { accessToken: session?.access_token, password: password.value },
    })
    done.value = true
  } catch (err: unknown) {
    const fetchErr = err as { data?: { message?: string } }
    serverError.value = fetchErr?.data?.message ?? 'Ошибка сброса пароля'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
.reset-root {
  max-width: 400px;
}

.success {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
