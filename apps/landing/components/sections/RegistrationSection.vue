<template>
  <section id="try" class="reg-root">
    <div class="container">
      <div v-if="!submitted" class="card">
        <div class="card-left">
          <span class="eyebrow">Попробуйте бесплатно</span>
          <h2 class="heading">Запустите заведение<br>за 5 минут</h2>
          <div class="sub">
            <p>14 дней без ограничений. Без карты.</p>
            <p>Свой сайт не нужен — просто выберите имя, и мы создадим его на поддомене. Например, <em>green-cafe.fastio.ru</em>. Свой домен можно подключить позже.</p>
          </div>
        </div>

        <div class="card-right">
          <FsForm @submit="onSubmit">
            <!-- Honeypot: скрыт от людей, заполняется ботами. -->
            <input
              v-model="honeypot"
              class="honeypot"
              type="text"
              name="website"
              tabindex="-1"
              autocomplete="off"
              aria-hidden="true"
            >

            <FsField
              label="Название заведения"
              name="name"
              :model-value="form.name"
              :rules="nameRules"
              required
            >
              <template #default="{ hasError }">
                <FsInput
                  v-model="form.name"
                  placeholder="Пицца Васи"
                  :error="hasError"
                  size="large"
                />
              </template>
            </FsField>

            <FsField
              label="Адрес сайта"
              name="slug"
              :model-value="form.slug"
              :rules="slugRules"
              :error="slugTaken ? 'Этот адрес уже занят' : slugFormatError ? 'Только латиница, цифры и дефис' : undefined"
              required
            >
              <template #default="{ hasError }">
                <FsInput
                  v-model="form.slug"
                  placeholder="vasya-pizza"
                  suffix=".fastio.ru"
                  :error="hasError || slugTaken"
                  :success="slugAvailable"
                  size="large"
                  autocomplete="off"
                  spellcheck="false"
                  @input="onSlugInput"
                >
                  <template #suffix>
                    <span class="slug-status">
                      <FsSpinner v-if="slugChecking" size="small" />
                      <CheckCircle v-else-if="slugAvailable" :size="16" class="slug-ok" />
                      <XCircle v-else-if="slugTaken" :size="16" class="slug-err" />
                    </span>
                  </template>
                </FsInput>
              </template>
            </FsField>

            <FsField
              label="Email"
              name="email"
              :model-value="form.email"
              :rules="emailRules"
              required
            >
              <template #default="{ hasError }">
                <FsInput
                  v-model="form.email"
                  type="email"
                  placeholder="owner@example.com"
                  :error="hasError"
                  size="large"
                />
              </template>
            </FsField>

            <div v-if="captchaClientKey" ref="captchaEl" class="captcha" />

            <p v-if="submitError" class="submit-error">{{ submitError }}</p>

            <FsButton type="submit" size="large" :loading="submitting" class="submit-btn">
              Начать бесплатно
            </FsButton>
          </FsForm>
        </div>
      </div>

      <div v-else class="success">
        <div class="success-icon">
          <CheckCircle :size="48" />
        </div>
        <h2 class="success-heading">Почти готово!</h2>
        <p class="success-text">
          Проверьте почту — мы отправили письмо на <strong>{{ form.email }}</strong>.<br>
          Перейдите по ссылке и задайте пароль.
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, reactive, onBeforeUnmount, onMounted } from 'vue'
import { $fetch } from 'ofetch'
import { CheckCircle, XCircle } from 'lucide-vue-next'
import { FsForm, FsField, FsInput, FsButton, FsSpinner } from '@fastio/public-ui'
import type { ValidationRule } from '@fastio/kit'
import { useRuntimeConfig } from '#imports'

const runtimeConfig = useRuntimeConfig()
const captchaClientKey = runtimeConfig.public.yandexCaptchaClientKey as string

const form = reactive({ name: '', slug: '', email: '' })
const honeypot = ref('')
const submitted = ref(false)
const submitting = ref(false)
const submitError = ref<string | null>(null)

// ─── Slug live-check ───────────────────────────────────────────────────────────

const slugChecking = ref(false)
const slugAvailable = ref(false)
const slugTaken = ref(false)
const slugFormatError = ref(false)
let slugTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSlugCheck(slug: string) {
  slugAvailable.value = false
  slugTaken.value = false
  slugFormatError.value = false
  if (slugTimer) clearTimeout(slugTimer)
  if (!slug || slug.length < 2) { slugChecking.value = false; return }

  slugChecking.value = true
  slugTimer = setTimeout(async () => {
    try {
      const res = await $fetch<{ available: boolean; reason?: string }>(`/api/check-slug?slug=${encodeURIComponent(slug.toLowerCase())}`)
      if (res.reason === 'format') {
        slugFormatError.value = true
      } else {
        slugAvailable.value = res.available
        slugTaken.value = !res.available
      }
    } catch {
      slugAvailable.value = false
      slugTaken.value = false
    } finally {
      slugChecking.value = false
    }
  }, 500)
}

function onSlugInput() {
  scheduleSlugCheck(form.slug)
}

onBeforeUnmount(() => {
  if (slugTimer) clearTimeout(slugTimer)
})

// ─── Validation rules ──────────────────────────────────────────────────────────

const nameRules: ValidationRule[] = [
  { type: 'required', message: 'Введите название заведения' },
]

const slugRules: ValidationRule[] = [
  { type: 'required', message: 'Введите адрес сайта' },
  { type: 'pattern', pattern: /^[a-z0-9-]+$/, message: 'Только латиница, цифры и дефис' },
]

const emailRules: ValidationRule[] = [
  { type: 'required', message: 'Введите email' },
  { type: 'email', message: 'Некорректный email' },
]

// ─── Yandex SmartCaptcha ───────────────────────────────────────────────────────

type SmartCaptchaApi = {
  render: (el: HTMLElement, opts: {
    sitekey: string
    callback?: (token: string) => void
    'error-callback'?: () => void
    invisible?: boolean
    hl?: 'ru' | 'en' | 'be' | 'kk' | 'tt' | 'uk' | 'uz' | 'tr'
  }) => number
  destroy: (id: number) => void
  reset: (id: number) => void
  execute: (id: number) => void
  getResponse: (id: number) => string
  subscribe: (id: number, event: 'challenge-hidden' | 'challenge-visible' | 'network-error' | 'success' | 'token-expired', cb: (token?: string) => void) => void
}

declare global {
  interface Window { smartCaptcha?: SmartCaptchaApi }
}

const captchaEl = ref<HTMLElement | null>(null)
const captchaToken = ref<string | null>(null)
let captchaWidgetId: number | null = null

function mountCaptcha() {
  if (!captchaClientKey || !captchaEl.value || !window.smartCaptcha) return
  captchaWidgetId = window.smartCaptcha.render(captchaEl.value, {
    sitekey: captchaClientKey,
    hl: 'ru',
    callback: (token: string) => { captchaToken.value = token },
    'error-callback': () => { captchaToken.value = null },
  })
}

onMounted(() => {
  if (!captchaClientKey) return

  if (window.smartCaptcha) {
    mountCaptcha()
    return
  }

  const existing = document.querySelector<HTMLScriptElement>('script[data-smart-captcha]')
  if (existing) {
    existing.addEventListener('load', mountCaptcha, { once: true })
    return
  }

  const script = document.createElement('script')
  script.src = 'https://smartcaptcha.yandexcloud.net/captcha.js'
  script.async = true
  script.defer = true
  script.dataset.smartCaptcha = '1'
  script.addEventListener('load', mountCaptcha, { once: true })
  document.head.appendChild(script)
})

onBeforeUnmount(() => {
  if (captchaWidgetId !== null && window.smartCaptcha) {
    window.smartCaptcha.destroy(captchaWidgetId)
  }
})

function resetCaptcha() {
  if (captchaWidgetId !== null && window.smartCaptcha) {
    window.smartCaptcha.reset(captchaWidgetId)
    captchaToken.value = null
  }
}

// ─── Submit ────────────────────────────────────────────────────────────────────

async function onSubmit() {
  if (slugTaken.value || slugChecking.value) return
  if (captchaClientKey && !captchaToken.value) {
    submitError.value = 'Подтвердите, что вы не робот'
    return
  }

  submitting.value = true
  submitError.value = null

  try {
    // Если public-ключ капчи не задан (dev), поле captchaToken не отправляем.
    // Сервер увидит undefined и (при пустом serverKey вне production) пропустит проверку.
    const body: Record<string, unknown> = {
      name: form.name,
      slug: form.slug.toLowerCase(),
      email: form.email,
      website: honeypot.value,
    }

    if (captchaToken.value) body.captchaToken = captchaToken.value

    await $fetch('/api/register', { method: 'POST', body })
    submitted.value = true
  } catch (err: unknown) {
    submitError.value = (err as { data?: { message?: string } })?.data?.message ?? 'Что-то пошло не так'
    resetCaptcha()
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.reg-root {
  background: var(--ln-surface);
  border-top: 1px solid var(--ln-border);
  padding: var(--section-spacing) 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 16px;

  @include md {
    padding: 0 32px;
  }
}

// ─── Card ──────────────────────────────────────────────────────────────────────

.card {
  display: flex;
  flex-direction: column;
  gap: 40px;
  background: var(--ln-surface-2);
  border: 1px solid var(--ln-border);
  border-radius: 20px;
  padding: 32px 24px;

  @include md {
    flex-direction: row;
    align-items: flex-start;
    padding: 48px 56px;
    gap: 64px;
  }
}

// ─── Left ──────────────────────────────────────────────────────────────────────

.card-left {
  @include flex-col(0);
  flex: 1;
  align-items: center;
  text-align: center;

  @include md {
    align-items: flex-start;
    text-align: left;
  }
}

.eyebrow {
  display: inline-block;
  @include text-xs(600);
  color: var(--ln-accent);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 12px;
}

.heading {
  font-family: var(--heading-font-family);
  font-size: 26px;
  font-weight: 700;
  color: var(--ln-white);
  line-height: 1.2;
  margin: 0 0 16px;

  @include md {
    font-size: 32px;
  }
}

.sub {
  @include text-body-sm;
  color: var(--ln-muted);
  margin: 0 0 28px;
  line-height: 1.6;

  p {
    margin: 0;

    & + p {
      margin-top: 12px;
    }
  }

  em {
    font-style: normal;
    color: var(--ln-white);
  }
}


// ─── Right (form) ──────────────────────────────────────────────────────────────

.card-right {
  flex: 1;
  width: 100%;

  @include md {
    max-width: 420px;
  }
}

.slug-status {
  display: flex;
  align-items: center;
  padding: 0 8px;
  flex-shrink: 0;
  color: var(--color-text-muted);
}

.slug-ok { color: var(--color-success); }
.slug-err { color: var(--color-error); }

.honeypot {
  position: absolute;
  left: -10000px;
  top: auto;
  width: 1px;
  height: 1px;
  overflow: hidden;
}

.captcha {
  display: flex;
  justify-content: center;
}

// ─── Submit ────────────────────────────────────────────────────────────────────

.submit-error {
  margin: 0;
  @include text-caption;
  color: var(--color-error);
}

.submit-btn {
  width: 100%;
}

// ─── Success ───────────────────────────────────────────────────────────────────

.success {
  @include flex-col(16px);
  align-items: center;
  text-align: center;
  padding: 48px 0;
}

.success-icon {
  color: var(--color-success);
}

.success-heading {
  font-family: var(--heading-font-family);
  font-size: 28px;
  font-weight: 700;
  color: var(--ln-white);
  margin: 0;
}

.success-text {
  @include text-body-sm;
  color: var(--ln-muted);
  margin: 0;
  line-height: 1.6;

  strong {
    color: var(--ln-white);
  }
}
</style>
