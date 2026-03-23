<template>
  <footer class="footer-root">
    <div class="container">
      <div class="top">
        <div class="left">
          <span class="logo"><span class="logo-fast">Fast</span><span class="logo-io">io</span></span>
          <span class="copy">&copy; {{ year }} Fastio</span>
        </div>

        <div class="right">
          <a href="/privacy" class="link">Политика конфиденциальности</a>
          <a href="/terms" class="link">Оферта</a>
          <a href="https://t.me/fastio" target="_blank" class="link">Telegram</a>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
const year = new Date().getFullYear()
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;
.footer-root {
  background: var(--ln-white);
  color: var(--ln-black);
  padding: 32px 0;
  border-top: 1px solid var(--color-border);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 16px;
}

.top {
  @include flex-col(20px);
}

.left {
  @include flex-row(16px);
}

.logo {
  font-family: var(--heading-font-family);
  font-weight: 800;
  font-size: 22px;
}

.logo-fast {
  color: var(--ln-black);
}

.logo-io {
  color: var(--ln-accent);
}

.copy {
  @include text-caption;
  color: var(--color-text-muted);
}

.right {
  @include flex-row(20px);
}

.link {
  color: var(--color-text-muted);
  text-decoration: none;
  @include text-caption;
  transition: color 0.15s;

  &:hover {
    color: var(--ln-black);
  }
}

@media (min-width: 768px) {
  .container {
    padding: 0 24px;
  }

  .top {
    @include flex-between;
  }
}
</style>
