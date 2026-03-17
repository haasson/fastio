<template>
  <TooltipProvider :delay-duration="delay">
    <TooltipRoot :disabled="disabled">
      <TooltipTrigger as-child>
        <slot />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent class="sf-tooltip-content" :side="side">
          {{ content }}
          <TooltipArrow class="sf-tooltip-arrow" />
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>
<script setup lang="ts">
import {
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  TooltipPortal,
  TooltipContent,
  TooltipArrow,
} from 'reka-ui'

type Props = {
  content: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  delay?: number
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  side: 'top',
  delay: 300,
  disabled: false,
})
</script>
<style lang="scss">
.sf-tooltip-content {
  background: var(--color-text);
  color: var(--color-bg);
  font-size: 12px;
  font-family: var(--font-family);
  padding: 6px 10px;
  border-radius: 6px;
  max-width: 240px;
  z-index: var(--z-toast, 500);
  line-height: 1.4;

  &[data-state='delayed-open'] { animation: sf-tooltip-in 0.15s ease; }
  &[data-state='closed'] { animation: sf-tooltip-out 0.1s ease; }
}

@keyframes sf-tooltip-in {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes sf-tooltip-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

.sf-tooltip-arrow {
  fill: var(--color-text);
}
</style>
