<template>
  <section id="cta" class="cta-root">
    <div class="container">
      <FsHeading as="h2" align="center" class="title">
        Запустите свой сайт сегодня
      </FsHeading>

      <FsText as="p" variant="body" align="center" class="subtitle">
        14 дней бесплатно. Без карты. Без звонков менеджерам.
      </FsText>

      <div class="actions">
        <FsButton size="large" class="btn-accent">Попробовать бесплатно</FsButton>
        <FsButton size="large" class="btn-dark">Смотреть демо</FsButton>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { FsHeading, FsText, FsButton } from '@fastio/public-ui'
</script>

<style scoped lang="scss">
.cta-root {
  background: var(--ln-black);
  padding: 64px 20px;
  display: flex;
  justify-content: center;

  @media (min-width: 768px) {
    padding: 80px 32px;
  }

  @media (min-width: 1280px) {
    padding: 100px 32px;
  }
}

.container {
  max-width: 640px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.title {
  color: var(--ln-white);
}

.subtitle {
  margin-top: 16px;
  color: rgba(255, 255, 255, 0.65);

  @media (min-width: 768px) {
    margin-top: 20px;
    font-size: 20px;
  }
}

.actions {
  margin-top: 32px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;

  @media (min-width: 480px) {
    flex-direction: row;
    justify-content: center;
    width: auto;
  }

  @media (min-width: 768px) {
    margin-top: 40px;
    gap: 16px;
  }
}

.btn-accent {
  background: var(--ln-accent) !important;
  color: var(--ln-white) !important;
  border-color: var(--ln-accent) !important;

  &:hover {
    opacity: 0.9;
  }
}

.btn-dark {
  background: rgba(255, 255, 255, 0.1) !important;
  color: var(--ln-white) !important;
  border: none !important;

  &:hover {
    background: rgba(255, 255, 255, 0.15) !important;
  }
}
</style>
