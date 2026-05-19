<template>
  <UiModal
    :model-value="modelValue"
    title="Подключить Telegram"
    :width="560"
    :closable="!justConnected"
    @update:model-value="$emit('update:modelValue', $event)"
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
          <UiText size="tiny" span class="tg-hint">Код действует 3 минуты</UiText>
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
import { UiModal, UiText, UiIcon } from '@fastio/ui'

defineProps<{
  modelValue: boolean
  dmDeepLink: string
  groupDeepLink: string
  dmQrDataUrl: string
  groupQrDataUrl: string
  polling: boolean
  justConnected: boolean
}>()

defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

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
