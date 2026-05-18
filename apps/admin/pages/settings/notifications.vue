<template>
  <div class="root">
    <UiFormSection title="Браузерные уведомления" :columns="1">
      <div class="prefs">
        <div class="pref">
          <div>
            <UiText size="small" class="pref-label">Мигающий счётчик в меню</UiText>
            <span class="hint">Счётчик новых заказов будет мигать в боковом меню</span>
          </div>
          <UiSwitch v-model="blinkingCounter" />
        </div>
      </div>
    </UiFormSection>

    <UiFormSection v-if="gate.telegramNotifications.value.enabled" title="Telegram" :columns="1">
      <UiText size="small" class="tg-intro">
        Подключи личный чат или группу — бот будет писать туда о каждом новом заказе и бронировании.
        Можно подключить несколько чатов: сообщения улетят во все сразу.
      </UiText>

      <div v-if="subscribers.length" class="subs">
        <div v-for="sub in subscribers" :key="sub.id" class="sub">
          <span class="sub-icon">
            <UiIcon :name="sub.chatType === 'private' ? 'smartphone' : 'users'" :size="20" />
          </span>
          <div class="sub-info">
            <UiText size="small" class="sub-label">{{ sub.label ?? 'Telegram-чат' }}</UiText>
            <UiText size="tiny" class="sub-meta">
              {{ chatTypeLabel(sub.chatType) }} · подключён {{ formatDate(sub.addedAt) }}
            </UiText>
          </div>
          <UiButton
            size="small"
            :loading="removingId === sub.id"
            @click="disconnect(sub)"
          >
            Отключить
          </UiButton>
        </div>
      </div>

      <UiEmpty v-else message="Пока нет подключённых чатов" />

      <UiButton
        size="small"
        type="primary"
        :loading="generating"
        class="add-btn"
        @click="connect"
      >
        {{ subscribers.length ? 'Подключить ещё чат' : 'Подключить Telegram' }}
      </UiButton>
    </UiFormSection>
  </div>

  <UiModal
    v-model="showModal"
    title="Подключить Telegram"
    :width="560"
    :closable="!justConnected"
  >
    <div class="tg-steps">
      <template v-if="!justConnected">
        <UiText size="small" class="modal-intro">
          Кликни по карточке чтобы открыть Telegram, или отсканируй QR с телефона.
        </UiText>

        <div class="link-options">
          <div class="link-option">
            <a
              :href="dmDeepLink"
              target="_blank"
              rel="noopener"
              class="link-btn"
            >
              <UiIcon name="smartphone" :size="20" />
              <span class="link-btn-text">
                <UiText size="small" span class="link-btn-title">В личный чат</UiText>
                <UiText size="tiny" span class="link-btn-desc">Бот будет писать тебе в личку</UiText>
              </span>
            </a>
            <div class="qr-wrap">
              <img
                v-if="dmQrDataUrl"
                :src="dmQrDataUrl"
                alt="QR для подключения личного чата"
                class="qr-img"
              />
              <UiText size="tiny" span class="qr-hint">или скан с телефона</UiText>
            </div>
          </div>

          <div class="link-option">
            <a
              :href="groupDeepLink"
              target="_blank"
              rel="noopener"
              class="link-btn"
            >
              <UiIcon name="users" :size="20" />
              <span class="link-btn-text">
                <UiText size="small" span class="link-btn-title">В группу</UiText>
                <UiText size="tiny" span class="link-btn-desc">Telegram предложит выбрать группу для бота</UiText>
              </span>
            </a>
            <div class="qr-wrap">
              <img
                v-if="groupQrDataUrl"
                :src="groupQrDataUrl"
                alt="QR для подключения группы"
                class="qr-img"
              />
              <UiText size="tiny" span class="qr-hint">или скан с телефона</UiText>
            </div>
          </div>
        </div>

        <div class="tg-status-row">
          <span v-if="polling" class="tg-waiting">
            <span class="spinner" />
            Ожидаем подключения...
          </span>
          <UiText size="tiny" span class="tg-hint">Код действует 15 минут</UiText>
        </div>
      </template>
      <template v-else>
        <div class="tg-success">
          <UiIcon name="checkRound" :size="32" class="tg-success-icon" />
          <UiText size="small" class="tg-success-text">Чат подключён!</UiText>
          <UiText size="tiny" class="tg-desc">Теперь уведомления о новых заказах и бронированиях будут приходить туда.</UiText>
        </div>
      </template>
    </div>
  </UiModal>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted, onMounted } from 'vue'
import { UiFormSection, UiButton, UiText, UiIcon, UiSwitch, UiModal, UiEmpty, useMessage } from '@fastio/ui'
import type { TenantTelegramSubscriber } from '@fastio/shared'
import { useNotificationPrefs } from '~/features/settings'
import { useTenantStore } from '~/shared/stores/tenant'
import { useGate } from '~/shared/plan/useGate'
import { useRuntimeConfig } from '#imports'
import { useDatabase } from '~/shared/data/useDatabase'
import { useConfirm } from '@fastio/kit'
import { renderQrToDataUrl } from '~/shared/utils/renderQr'

const { blinkingCounter } = useNotificationPrefs()
const tenantStore = useTenantStore()
const gate = useGate()
const { telegramLink } = useDatabase()
const { confirm } = useConfirm()
const { success } = useMessage()

const generating = ref(false)
const removingId = ref<string | null>(null)
const showModal = ref(false)
const linkCode = ref('')
const polling = ref(false)
const justConnected = ref(false)
const subscribers = ref<TenantTelegramSubscriber[]>([])
const subsCountAtOpen = ref(0)
const dmQrDataUrl = ref('')
const groupQrDataUrl = ref('')

let pollInterval: ReturnType<typeof setInterval> | null = null

const botUsername = useRuntimeConfig().public.telegramTenantBotUsername

const dmDeepLink = computed(() => `https://t.me/${botUsername}?start=${linkCode.value}`)
const groupDeepLink = computed(() => `https://t.me/${botUsername}?startgroup=${linkCode.value}`)

const chatTypeLabel = (type: TenantTelegramSubscriber['chatType']): string => {
  if (type === 'private') return 'Личный чат'
  if (type === 'channel') return 'Канал'

  return 'Группа'
}

const formatDate = (iso: string): string => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(iso))

const loadSubscribers = async () => {
  const tid = tenantStore.currentTenantId

  if (!tid) return

  subscribers.value = await telegramLink.listSubscribers(tid)
}

const stopPolling = () => {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
  polling.value = false
}

const startPolling = () => {
  polling.value = true
  pollInterval = setInterval(async () => {
    await loadSubscribers()

    if (subscribers.value.length > subsCountAtOpen.value) {
      stopPolling()
      justConnected.value = true
      setTimeout(() => {
        showModal.value = false
      }, 2000)
    }
  }, 3000)
}

watch(showModal, (open) => {
  if (!open) {
    stopPolling()
    justConnected.value = false
  }
})

onMounted(() => {
  loadSubscribers()
})

onUnmounted(() => stopPolling())

const connect = async () => {
  const tid = tenantStore.currentTenantId

  if (!tid) return

  generating.value = true
  try {
    // 6 цифр читается проще буквенно-цифровой смеси. Энтропия закрывается
    // server-side rate-limit'ом в /api/telegram/webhook (5 попыток/15 мин на chat).
    // crypto.getRandomValues — чтобы код не был предсказуем при знании seed (Math.random
    // не cryptographically secure). PK-коллизия в окне 3 мин крайне маловероятна;
    // если упадёт INSERT — юзер просто кликнет «Подключить» ещё раз.
    const buf = new Uint32Array(1)

    globalThis.crypto.getRandomValues(buf)
    const code = (100000 + (buf[0] % 900000)).toString()

    await telegramLink.upsertCode(tid, code)
    linkCode.value = code

    // QR заранее, чтобы при открытии модалки не было «прыжка» от пустого слота к картинке.
    const [dm, group] = await Promise.all([
      renderQrToDataUrl(dmDeepLink.value, 160),
      renderQrToDataUrl(groupDeepLink.value, 160),
    ])

    dmQrDataUrl.value = dm
    groupQrDataUrl.value = group

    justConnected.value = false
    subsCountAtOpen.value = subscribers.value.length
    showModal.value = true
    startPolling()
  } finally {
    generating.value = false
  }
}

const disconnect = async (sub: TenantTelegramSubscriber) => {
  const ok = await confirm({
    title: 'Отключить чат?',
    message: `${sub.label ?? 'Telegram-чат'} перестанет получать уведомления о заказах и бронированиях.`,
    confirmText: 'Отключить',
    confirmType: 'error',
  })

  if (!ok) return

  removingId.value = sub.id
  try {
    await telegramLink.removeSubscriber(sub.id)
    await loadSubscribers()
    success('Чат отключён')
  } finally {
    removingId.value = null
  }
}

</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.root {
  @include flex-col(var(--space-12));
  max-width: 680px;
}

.hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-loose);
}

.prefs {
  @include flex-col(var(--space-12));
}

.pref {
  @include flex-between(var(--space-16));
}

.pref-label {
  font-weight: var(--font-weight-medium);
  margin-bottom: var(--space-4);
  display: block;
}

.tg-intro {
  color: var(--color-text-secondary);
  margin-bottom: var(--space-8);
}

.subs {
  @include flex-col(var(--space-8));
}

.sub {
  @include flex-row(var(--space-12));
  padding: var(--space-12);
  background: var(--color-bg-page);
  border-radius: var(--radius-12);
  align-items: center;
}

.sub-icon {
  display: flex;
  align-items: center;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.sub-info {
  flex: 1;
  min-width: 0;
}

.sub-label {
  font-weight: var(--font-weight-medium);
  color: var(--color-title);
  margin-bottom: var(--space-2);
}

.sub-meta {
  color: var(--color-text-secondary);
}

.add-btn {
  align-self: flex-start;
  margin-top: var(--space-8);
}

.tg-steps {
  @include flex-col(var(--space-12));
}

.modal-intro {
  color: var(--color-text-secondary);
}

.link-options {
  @include flex-col(var(--space-12));
}

.link-option {
  @include flex-col(var(--space-8));
  padding: var(--space-12);
  background: var(--color-bg-page);
  border-radius: var(--radius-12);
}

.link-btn {
  @include flex-row(var(--space-12));
  text-decoration: none;
  color: inherit;
  align-items: center;
  padding: var(--space-8);
  margin: calc(-1 * var(--space-8));
  border-radius: var(--radius-8);
  transition: background 0.15s ease;

  &:hover {
    background: var(--color-bg-hover);
  }
}

.link-btn-text {
  @include flex-col(var(--space-2));
  flex: 1;
}

.link-btn-title {
  font-weight: var(--font-weight-semibold);
  color: var(--color-title);
}

.link-btn-desc {
  color: var(--color-text-secondary);
}

.qr-wrap {
  @include flex-col(var(--space-4));
  align-items: center;
  padding-top: var(--space-8);
  border-top: 1px solid var(--color-border-light);
}

.qr-img {
  width: 140px;
  height: 140px;
  border-radius: var(--radius-8);
  background: #fff; /* QR всегда на белом — иначе сканеры не читают */
  padding: var(--space-4);
}

.qr-hint {
  color: var(--color-text-secondary);
}

.tg-status-row {
  @include flex-between;
}

.tg-waiting {
  @include flex-row;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.tg-hint {
  color: var(--color-text-secondary);
}

.tg-success {
  @include flex-col;
  align-items: center;
  padding: var(--space-16) 0;
  text-align: center;
}

.tg-success-icon {
  color: var(--color-success);
}

.tg-success-text {
  font-weight: var(--font-weight-semibold);
}

.tg-desc {
  color: var(--color-text-secondary);
}

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-text-secondary);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
