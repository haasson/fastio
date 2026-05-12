<template>
  <div v-if="show" class="hint-root">
    <button
      type="button"
      class="trigger"
      :aria-expanded="open"
      :aria-controls="contentId"
      @click="open = !open"
    >
      <span class="trigger-text">{{ summaryText }}</span>
      <ChevronDown :size="14" :stroke-width="2" class="chevron" :class="{ open }" />
    </button>

    <div :id="contentId" class="reveal" :class="{ expanded: open }">
      <div class="reveal-inner">
        <div class="card">
          <div v-if="availableBranches.length" class="group">
            <div class="label">Доступно</div>
            <div class="tags">
              <FsTag v-for="b in availableBranches" :key="b.id" as="span" size="small" active>
                {{ b.name }}
              </FsTag>
            </div>
          </div>

          <div v-if="missingBranches.length" class="group group-missing">
            <div class="label">Не доступно</div>
            <div class="tags">
              <FsTag v-for="b in missingBranches" :key="b.id" as="span" size="small" removed>
                {{ b.name }}
              </FsTag>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useNuxtData } from 'nuxt/app'
import { ChevronDown } from 'lucide-vue-next'
import { FsTag } from '@fastio/public-ui'
import type { Tenant } from '@fastio/shared'

type BranchInfo = { id: string; name: string }

const props = defineProps<{
  branchIds: string[]
}>()

const { data: tenant } = useNuxtData<Tenant>('tenant')
const { data: branchesData } = useNuxtData<BranchInfo[]>('branches')

const allBranches = computed<BranchInfo[]>(() => branchesData.value ?? [])

const isUnified = computed(() => tenant.value?.branchSelectionMode !== 'per_branch')

const isEverywhere = computed(() =>
  props.branchIds.length === 0 || props.branchIds.length >= allBranches.value.length,
)

const show = computed(() =>
  isUnified.value && allBranches.value.length > 1 && !isEverywhere.value,
)

const availableSet = computed(() => new Set(props.branchIds))

const availableBranches = computed(() =>
  allBranches.value.filter((b) => availableSet.value.has(b.id)),
)

const missingBranches = computed(() =>
  allBranches.value.filter((b) => !availableSet.value.has(b.id)),
)

const summaryText = computed(
  () => `Доступно в ${availableBranches.value.length} из ${allBranches.value.length} филиалов`,
)

const open = ref(false)
const contentId = useId()
</script>

<style scoped lang="scss">
.hint-root {
  display: block;
}

.trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  font: inherit;
  font-size: 13px;
  line-height: 1.4;
  cursor: pointer;
  transition: color 120ms ease;

  &:hover,
  &:focus-visible {
    color: var(--color-text);
    outline: none;
  }
}

.trigger-text {
  text-decoration: underline;
  text-decoration-style: dotted;
  text-decoration-color: currentColor;
  text-underline-offset: 3px;
}

.chevron {
  flex-shrink: 0;
  transition: transform 200ms ease;

  &.open {
    transform: rotate(180deg);
  }
}

.reveal {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 240ms ease;

  &.expanded {
    grid-template-rows: 1fr;
  }
}

.reveal-inner {
  overflow: hidden;
  min-height: 0;
}

.card {
  margin-top: 12px;
  padding: 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  box-sizing: border-box;
}

.group-missing {
  margin-top: 16px;
}

.label {
  display: block;
  margin: 0 0 8px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
