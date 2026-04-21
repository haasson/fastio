<template>
  <div class="help-layout">
    <header class="help-header">
      <div class="help-header-inner">
        <div class="help-header-left">
          <NuxtLink to="/" class="help-logo">
            <span class="help-logo-text">Fast<span class="help-logo-accent">io</span></span>
          </NuxtLink>
          <span class="help-logo-sep">/</span>
          <span class="help-logo-label">База знаний</span>
        </div>

      </div>
    </header>

    <slot />
  </div>
</template>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as mq;

.help-layout {
  min-height: 100vh;
  background: var(--color-bg-page);
  display: flex;
  flex-direction: column;
}

.help-header {
  background: var(--color-bg-card);
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 50;
  flex-shrink: 0;
}

.help-header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-16);
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--space-24);
  height: 56px;
}

.help-header-left {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.help-logo {
  text-decoration: none;
}

/* stylelint-disable scale-unlimited/declaration-strict-value */
.help-logo-text {
  font-family: 'Urbanist', sans-serif;
  font-weight: 800;
  font-size: 18px;
  line-height: 1;
  color: var(--color-text);
}
/* stylelint-enable scale-unlimited/declaration-strict-value */

.help-logo-accent {
  color: var(--orange-600);
}

.help-logo-sep {
  color: var(--color-text-hint);
  font-size: var(--font-size-md);
}

.help-logo-label {
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
}

</style>
