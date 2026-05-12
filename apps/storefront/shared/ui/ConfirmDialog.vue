<template>
  <FsDialog
    :model-value="state.open"
    :title="state.title"
    size="sm"
    :closable="false"
    :level="1"
    silent-history
    force-dialog
    @update:model-value="onCancel"
  >
    <div class="confirm-body">
      <p v-if="state.message" class="confirm-message">{{ state.message }}</p>

      <div v-if="state.sections.length > 0" class="confirm-sections">
        <div v-for="(section, idx) in state.sections" :key="idx" class="confirm-section">
          <div class="confirm-section-title">{{ section.title }}</div>
          <ul class="confirm-section-list">
            <!-- composite-key: одно и то же имя ("Стрижка") может встретиться в
                 нескольких секциях ("Удалятся" и "Сбросится мастер"); :key="item"
                 коллизировал и Vue рендерил только одну строку из дублей. -->
            <li
              v-for="(item, itemIdx) in section.items"
              :key="`${idx}-${itemIdx}-${item}`"
              class="confirm-section-item"
            >{{ item }}</li>
          </ul>
        </div>
      </div>
    </div>

    <template #footer>
      <FsButton variant="ghost" @click="onCancel">{{ state.cancelLabel }}</FsButton>
      <FsButton :variant="state.danger ? 'destructive' : 'primary'" @click="onConfirm">
        {{ state.confirmLabel }}
      </FsButton>
    </template>
  </FsDialog>
</template>

<script setup lang="ts">
import { FsDialog, FsButton } from '@fastio/public-ui'
import { useConfirm } from '~/shared/composables/useConfirm'

const { state, onConfirm, onCancel } = useConfirm()
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.confirm-body {
  @include flex-col(14px);
}

.confirm-message {
  font-size: 13px;
  line-height: 1.5;
  color: var(--color-text-secondary);
  margin: 0;
}

.confirm-sections {
  @include flex-col(12px);
}

.confirm-section {
  @include flex-col(4px);
}

.confirm-section-title {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--color-text);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.confirm-section-list {
  margin: 0;
  padding-left: 16px;
  list-style: disc;
  @include flex-col(2px);
}

.confirm-section-item {
  font-size: 13px;
  line-height: 1.45;
  color: var(--color-text-secondary);
  list-style: inherit;
}
</style>
