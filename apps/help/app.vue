<template>
  <NuxtLayout>
    <div class="help-body">
      <HelpNav />
      <main class="help-content">
        <NuxtPage />
      </main>
    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
import HelpNav from '~/components/HelpNav.vue'
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as mq;

.help-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-24);
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  padding: var(--space-32) var(--space-24);

  @include mq.mq-m {
    display: grid;
    grid-template-columns: 240px 1fr;
    gap: var(--space-32);
    align-items: start;
  }
}

.help-content {
  min-width: 0;
}
</style>
