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
    :width="480"
    :closable="!justConnected"
  >
    <div class="tg-steps">
      <template v-if="!justConnected">
        <UiText size="small" class="modal-intro">
          Выбери куда подключать. Telegram откроется и сам подставит код привязки.
        </UiText>

        <a
          :href="dmDeepLink"
          target="_blank"
          rel="noopener"
          class="link-btn"
        >
          <UiIcon name="smartphone" :size="20" />
          <span class="link-btn-text">
            <span class="link-btn-title">В личный чат</span>
            <span class="link-btn-desc">Бот будет писать тебе в личку</span>
          </span>
        </a>

        <a
          :href="groupDeepLink"
          target="_blank"
          rel="noopener"
          class="link-btn"
        >
          <UiIcon name="users" :size="20" />
          <span class="link-btn-text">
            <span class="link-btn-title">В группу</span>
            <span class="link-btn-desc">Telegram предложит выбрать группу для бота</span>
          </span>
        </a>

        <details class="manual-block">
          <summary>Подключить вручную</summary>
          <p>Открой <b>@{{ botUsername }}</b> и отправь команду:</p>
          <div class="tg-code">
            <code>/start {{ linkCode }}</code>
            <UiButton size="small" @click="copyCode">Скопировать</UiButton>
          </div>
          <p class="hint">Для группы — назначь бота администратором или используй deep-link выше.</p>
        </details>

        <div class="tg-status-row">
          <span v-if="polling" class="tg-waiting">
            <span class="spinner" />
            Ожидаем подключения...
          </span>
          <span class="tg-hint">Код действует 15 минут</span>
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
    // 6 цифр читается проще буквенно-цифровой смеси. PK-коллизия в окне 15 мин
    // крайне маловероятна; если упадёт INSERT — юзер просто кликнет «Подключить» ещё раз.
    const code = Math.floor(100000 + Math.random() * 900000).toString()

    await telegramLink.upsertCode(tid, code)
    linkCode.value = code
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

const copyCode = () => {
  navigator.clipboard.writeText(`/start ${linkCode.value}`)
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
  color: var(--grey-800);
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

.link-btn {
  @include flex-row(var(--space-12));
  padding: var(--space-12);
  background: var(--color-bg-page);
  border-radius: var(--radius-12);
  text-decoration: none;
  color: inherit;
  align-items: center;
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
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--grey-800);
}

.link-btn-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.manual-block {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);

  summary {
    cursor: pointer;
    padding: var(--space-8) 0;
    font-weight: var(--font-weight-medium);
  }

  p {
    margin: var(--space-8) 0;
    /* stylelint-disable-next-line scale-unlimited/declaration-strict-value */
    line-height: 1.6;
  }
}

.tg-code {
  @include flex-row;
  padding: var(--space-8) var(--space-12);
  background: var(--color-bg-page);
  border-radius: var(--radius-8);

  code {
    flex: 1;
    font-size: var(--font-size-md);
    font-family: monospace;
    user-select: all;
  }
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
  font-size: var(--font-size-sm);
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
