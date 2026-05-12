<template>
  <FsDialog
    :model-value="show"
    :closable="manuallyOpened"
    :close-on-overlay="manuallyOpened"
    title="Выберите филиал"
    size="sm"
    @update:model-value="onModelUpdate"
  >
    <FsText v-if="branches.length > 1" variant="caption" color="secondary" class="hint">
      Выберите филиал, в который пойдёте — и мы покажем именно его меню.
      Сменить можно в любой момент через меню или шапку.
    </FsText>
    <FsText v-else-if="branches.length === 0" variant="caption" color="secondary" class="hint">
      Сейчас нет доступных филиалов.
    </FsText>
    <ul v-if="branches.length > 0" class="branches">
      <li v-for="b in branches" :key="b.id">
        <button
          class="branch"
          :class="{ current: b.id === branchStore.id }"
          type="button"
          @click="pick(b.id)"
        >
          <span class="name">{{ b.name }}</span>
          <span v-if="formatBranchAddressShort(b)" class="addr">{{ formatBranchAddressShort(b) }}</span>
        </button>
      </li>
    </ul>
  </FsDialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useNuxtData } from 'nuxt/app'
import type { BranchPublic, Tenant } from '@fastio/shared'
import { formatBranchAddressShort } from '@fastio/shared'
import { FsDialog, FsText } from '@fastio/public-ui'
import { useSelectedBranchStore } from '../stores/selectedBranch'
import { useBranchSwitcher } from '../composables/useBranchSwitcher'

const branchStore = useSelectedBranchStore()
const { switchTo } = useBranchSwitcher()

const { data: branchesData } = useNuxtData<BranchPublic[]>('branches')
const { data: tenant } = useNuxtData<Tenant>('tenant')

const branches = computed(() => branchesData.value ?? [])
const manuallyOpened = ref(false)

const show = computed(() => {
  if (tenant.value?.branchSelectionMode !== 'per_branch') return false
  if (manuallyOpened.value) return true
  // Авто-показ: только после restore() и если филиал не выбран.
  // На SSR restored=false → модалка не покажется (правильно).
  return branchStore.restored && !branchStore.id
})

function open() {
  manuallyOpened.value = true
}

async function pick(id: string) {
  const ok = await switchTo(id)

  if (ok) manuallyOpened.value = false
}

function onModelUpdate(value: boolean) {
  if (!value && manuallyOpened.value) {
    manuallyOpened.value = false
  }
}

defineExpose({ open })
</script>

<style scoped lang="scss">
.hint {
  display: block;
  margin-bottom: 16px;
  color: var(--color-text-secondary);
}

.branches {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.branch {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: transparent;
  text-align: left;
  cursor: pointer;
  width: 100%;
  font: inherit;
  color: var(--color-text);
  transition: border-color 0.15s, background 0.15s;

  &:hover,
  &.current {
    border-color: var(--primary);
    background: var(--primary-subtle);
  }
}

.name {
  font-weight: 500;
}

.addr {
  color: var(--color-text-secondary);
  font-size: 13px;
}
</style>
