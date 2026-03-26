<template>
  <div class="wizard-root">
    <div class="wizard-container">
      <!-- Progress -->
      <div class="progress">
        <div
          v-for="i in totalSteps"
          :key="i"
          class="progress-dot"
          :class="{ active: i === step, done: i < step }"
        />
      </div>

      <!-- Steps -->
      <div class="step-content">
        <OnboardingStepType
          v-if="step === 1"
          v-model="form.businessType"
        />
        <OnboardingStepInfo
          v-else-if="step === 2"
          v-model:name="form.name"
          v-model:phone="form.phone"
          v-model:timezone="form.timezone"
        />
        <OnboardingStepBranch
          v-else-if="step === 3"
        />
        <OnboardingStepModules
          v-else-if="step === 4"
          v-model:delivery="form.delivery"
          v-model:pickup="form.pickup"
          v-model:dine-in="form.dineIn"
        />
        <OnboardingStepComplete
          v-else-if="step === 5"
        />
      </div>

      <!-- Navigation -->
      <div class="nav">
        <UiButton
          v-if="step > 1 && step < 5"
          type="secondary"
          @click="prev"
        >
          Назад
        </UiButton>
        <div v-else class="spacer" />

        <UiButton
          v-if="step < 5"
          type="primary"
          :disabled="!canProceed"
          :loading="saving"
          @click="next"
        >
          Далее
        </UiButton>
        <UiButton
          v-else
          type="primary"
          :loading="saving"
          @click="finish"
        >
          Перейти в админку
        </UiButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { UiButton } from '@fastio/ui'
import type { BusinessType } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useBranchStore } from '~/stores/branch'
import OnboardingStepType from '~/components/onboarding/OnboardingStepType.vue'
import OnboardingStepInfo from '~/components/onboarding/OnboardingStepInfo.vue'
import OnboardingStepBranch from '~/components/onboarding/OnboardingStepBranch.vue'
import OnboardingStepModules from '~/components/onboarding/OnboardingStepModules.vue'
import OnboardingStepComplete from '~/components/onboarding/OnboardingStepComplete.vue'

const tenantStore = useTenantStore()
const branchStore = useBranchStore()

const totalSteps = 5
const step = ref(1)
const saving = ref(false)
const form = reactive({
  businessType: tenantStore.tenant?.businessType ?? null as BusinessType | null,
  name: tenantStore.tenant?.name ?? '',
  phone: tenantStore.tenant?.contacts?.phone ?? '',
  timezone: tenantStore.tenant?.timezone ?? 'Europe/Moscow',
  delivery: tenantStore.tenant?.modules?.delivery ?? true,
  pickup: tenantStore.tenant?.modules?.pickup ?? true,
  dineIn: tenantStore.tenant?.modules?.dineIn ?? false,
})

const canProceed = computed(() => {
  switch (step.value) {
    case 1:
      return !!form.businessType
    case 2:
      return form.name.trim().length > 0 && form.phone.trim().length > 0
    case 3:
      return branchStore.hasBranches
    case 4:
      return form.delivery || form.pickup || form.dineIn
    default:
      return true
  }
})

const prev = () => {
  if (step.value > 1) step.value--
}

const next = async () => {
  if (!canProceed.value) return

  saving.value = true
  try {
    if (step.value === 1) {
      await tenantStore.update({ businessType: form.businessType })
    } else if (step.value === 2) {
      await tenantStore.update({
        name: form.name.trim(),
        contacts: {
          ...tenantStore.tenant!.contacts,
          phone: form.phone.trim(),
        },
        timezone: form.timezone,
      })
    } else if (step.value === 3) {
      // Branch is saved inline via branchStore.add — nothing to save here
    } else if (step.value === 4) {
      await tenantStore.update({
        modules: {
          ...tenantStore.tenant!.modules,
          delivery: form.delivery,
          pickup: form.pickup,
          dineIn: form.dineIn,
        },
      })
    }

    step.value++
  } finally {
    saving.value = false
  }
}

const finish = async () => {
  saving.value = true
  try {
    await tenantStore.update({ onboardingCompleted: true })
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
.wizard-root {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: var(--color-bg-page);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow-y: auto;
}

.wizard-container {
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.progress {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.progress-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-border);
  transition: background 0.2s;

  &.active {
    background: var(--color-primary);
  }

  &.done {
    background: var(--color-primary);
    opacity: 0.5;
  }
}

.step-content {
  min-height: 280px;
}

.nav {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.spacer {
  flex: 1;
}
</style>
