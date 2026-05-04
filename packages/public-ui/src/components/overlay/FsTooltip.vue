<template>
  <TooltipProvider :delay-duration="delay">
    <TooltipRoot :disabled="disabled">
      <TooltipTrigger as-child>
        <slot />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent class="fs-tooltip-content" :side="side">
          {{ content }}
          <TooltipArrow class="fs-tooltip-arrow" />
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

withDefaults(defineProps<Props>(), {
  side: 'top',
  delay: 300,
  disabled: false,
})
</script>
<style lang="scss">
.fs-tooltip-content {
  background: var(--color-text);
  color: var(--color-bg);
  font-size: 12px;
  font-family: var(--font-family);
  padding: 6px 10px;
  border-radius: 6px;
  max-width: 240px;
  z-index: var(--z-toast, 500);
  line-height: 1.4;
  white-space: pre-line;

  &[data-state='delayed-open'] { animation: fs-tooltip-in 0.15s ease; }
  &[data-state='closed'] { animation: fs-tooltip-out 0.1s ease; }
}

@keyframes fs-tooltip-in {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes fs-tooltip-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

.fs-tooltip-arrow {
  fill: var(--color-text);
}
</style>
