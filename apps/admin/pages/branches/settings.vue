<template>
  <div class="settings-root">
    <TenantContactsBlock
      ref="contactsBlockRef"
      title="Общие настройки заведения"
      subtitle="Используются по умолчанию во всех филиалах. В каждом филиале можно переопределить."
    />

    <UiCard v-if="branches.length > 1 && !tenantStore.isServices" size="large" class="branch-mode-card">
      <UiSectionHeader title="Как клиент попадает в филиал" />
      <p class="mode-hint">{{ modeTexts.hint }}</p>
      <div class="mode-options">
        <label class="mode-option" :class="{ active: branchMode === 'unified' }">
          <input
            v-model="branchMode"
            type="radio"
            value="unified"
            class="mode-radio"
          />
          <span class="mode-content">
            <strong>{{ modeTexts.unified.title }} <span class="mode-tag">подходит большинству</span></strong>
            <span class="mode-desc">
              <em>Когда выбрать:</em> {{ modeTexts.unified.when }}
            </span>
            <span class="mode-desc">
              <em>Что увидит клиент:</em> {{ modeTexts.unified.what }}
            </span>
          </span>
        </label>

        <label class="mode-option" :class="{ active: branchMode === 'per_branch' }">
          <input
            v-model="branchMode"
            type="radio"
            value="per_branch"
            class="mode-radio"
          />
          <span class="mode-content">
            <strong>{{ modeTexts.perBranch.title }}</strong>
            <span class="mode-desc">
              <em>Когда выбрать:</em> {{ modeTexts.perBranch.when }}
            </span>
            <span class="mode-desc">
              <em>Что увидит клиент:</em> {{ modeTexts.perBranch.what }}
            </span>
          </span>
        </label>
      </div>
    </UiCard>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { UiCard, UiSectionHeader } from '@fastio/ui'
import type { BranchSelectionMode } from '@fastio/shared'
import { useTenantStore } from '~/shared/stores/tenant'
import { useBranchStore } from '~/shared/stores/branch'
import { useTerms } from '~/features/legal'
import TenantContactsBlock from '~/features/settings/components/TenantContactsBlock.vue'
import { useRegisterPageForm } from '~/composables/ui/usePageForm'
import { useUnsavedGuard } from '~/composables/ui/useUnsavedGuard'
import type { FormHandle } from '~/composables/ui/useEditableForm'

const tenantStore = useTenantStore()
const branchStore = useBranchStore()
const { branches } = storeToRefs(branchStore)
const terms = useTerms()

// Тексты адаптируем под бизнес: общепит / ритейл / услуги. Тон и примеры разные,
// структура (заголовок + Когда выбрать + Что увидит клиент) одна.
const modeTexts = computed(() => {
  if (tenantStore.isServices) {
    return {
      hint: 'Если у вас несколько точек, нужно решить — клиент сразу выбирает, куда он идёт, или сначала набирает услуги, а филиал подбирается под него.',
      unified: {
        title: 'Один общий каталог',
        when: 'в филиалах примерно одни и те же услуги. Клиент приходит за услугой, а не за конкретной точкой — например, типовой барбершоп или сетевой массажный кабинет.',
        what: 'все услуги в одной витрине. Если какая-то услуга есть не везде, покажем подсказку. Филиал клиент укажет уже на этапе записи — выбором мастера или ближайшей точки.',
      },
      perBranch: {
        title: 'Отдельный каталог под филиал',
        when: 'у филиалов разная команда или специализация. Например: разные клиники с разными врачами, салон с уникальной мастер-командой в каждой точке, центры с разными направлениями.',
        what: 'клиент с первого экрана выбирает филиал и видит только его услуги и мастеров. Сменить филиал можно в шапке — мы предупредим, если в новой точке нет того, что он уже выбрал.',
      },
    }
  }
  if (terms.menuStyle === 'catalog') {
    return {
      hint: 'Если у вас несколько точек, нужно решить — клиент сразу выбирает магазин, или сначала набирает корзину, а магазин подбирается под неё.',
      unified: {
        title: 'Один общий каталог',
        when: 'в магазинах примерно один ассортимент. Клиент приходит за товаром и не задумывается, в какой именно магазин — например, сетевой ритейл с одинаковой полкой.',
        what: 'весь ассортимент в одном каталоге. Если какой-то товар есть не везде, покажем подсказку и в корзине отметим магазины, которые соберут заказ полностью. Магазин привязываем на чекауте: для доставки — по адресу, для самовывоза — клиент выбирает ближайший.',
      },
      perBranch: {
        title: 'Отдельный каталог под филиал',
        when: 'у магазинов разный ассортимент или специализация. Например: флагман с премиум-линейкой и точка с базовым набором, либо магазины с принципиально разными категориями.',
        what: 'клиент с первого экрана выбирает магазин и видит только его товары. Сменить можно в шапке — мы предупредим, если в другом магазине нет товаров из корзины.',
      },
    }
  }

  // food (общепит)
  return {
    hint: 'Если у вас несколько точек, нужно решить — клиент сразу выбирает заведение, или сначала собирает корзину, а филиал подбирается под неё.',
    unified: {
      title: 'Одно общее меню',
      when: 'в филиалах примерно одно и то же меню. Клиент приходит за конкретным блюдом, а не за конкретной точкой — например, сеть пиццерий или кофеен с единой картой.',
      what: 'всё меню сразу. Если какое-то блюдо есть не везде, покажем подсказку. В корзине отметим, какие филиалы соберут заказ полностью. Филиал привязываем на чекауте: для доставки — по адресу, для самовывоза — клиент выбирает ближайший.',
    },
    perBranch: {
      title: 'Отдельное меню под филиал',
      when: 'у филиалов разная кухня или сильно разный ассортимент. Например: одна точка работает как кофейня, другая — как полноценный ресторан, или сезонные форматы с разной картой.',
      what: 'клиент с первого экрана выбирает филиал и видит только его меню. Сменить можно в шапке — мы предупредим, если в новом филиале нет блюд из корзины.',
    },
  }
})

const branchMode = ref<BranchSelectionMode>(tenantStore.tenant.branchSelectionMode)
const branchModeSaving = ref(false)

watch(() => tenantStore.tenant.branchSelectionMode, (v) => {
  branchMode.value = v
})

const branchModeHandle: FormHandle = {
  isDirty: computed(() => branchMode.value !== tenantStore.tenant.branchSelectionMode),
  saving: computed(() => branchModeSaving.value),
  submit: async () => {
    branchModeSaving.value = true
    try {
      await tenantStore.update({ branchSelectionMode: branchMode.value })
    } finally {
      branchModeSaving.value = false
    }
  },
  reset: () => {
    branchMode.value = tenantStore.tenant.branchSelectionMode
  },
}

const contactsBlockRef = shallowRef<{ handle: FormHandle } | null>(null)
const handles = computed<FormHandle[]>(() => {
  // services-тенанты всегда per_branch (DB constraint), форма скрыта — handle не нужен
  const list: FormHandle[] = tenantStore.isServices ? [] : [branchModeHandle]

  if (contactsBlockRef.value?.handle) list.push(contactsBlockRef.value.handle)

  return list
})

const pageHandle: FormHandle = {
  isDirty: computed(() => handles.value.some((h) => h.isDirty.value)),
  saving: computed(() => handles.value.some((h) => h.saving.value)),
  submit: async () => {
    for (const h of handles.value) {
      if (h.isDirty.value) await h.submit()
    }
  },
  reset: () => handles.value.forEach((h) => h.reset()),
}

useRegisterPageForm(pageHandle)
useUnsavedGuard(pageHandle.isDirty)
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.settings-root {
  @include flex-col(var(--space-16));
}

.branch-mode-card {
  gap: var(--space-12);
}

.mode-hint {
  font-size: var(--font-size-sm);
  color: var(--color-text);
  line-height: var(--line-height-loose);
  margin: 0;
}

.mode-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

.mode-option {
  display: flex;
  align-items: flex-start;
  gap: var(--space-12);
  padding: var(--space-12);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  cursor: pointer;
  transition: border-color var(--transition-fast), background var(--transition-fast);

  &:hover {
    border-color: var(--color-primary);
  }

  &.active {
    border-color: var(--color-primary);
    background: var(--color-primary-soft);
  }
}

.mode-radio {
  margin-top: var(--space-4);
  flex-shrink: 0;
}

.mode-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.mode-tag {
  display: inline-block;
  margin-left: var(--space-8);
  padding: 2px var(--space-8);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-primary);
  background: var(--color-primary-soft);
  border-radius: var(--radius-pill);
  vertical-align: middle;
}

.mode-desc {
  display: block;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-loose);

  em {
    font-style: normal;
    font-weight: var(--font-weight-medium);
  }
}
</style>
