<template>
  <section id="clients" class="clients-root">
    <div class="container">
      <span class="label">Примеры</span>

      <FsHeading as="h2" align="center">
        Как выглядят сайты клиентов
      </FsHeading>
      <FsText variant="body" color="secondary" align="center" class="subtitle">
        Каждый настраивает под свой стиль. Один редактор — разные результаты.
      </FsText>

      <div class="grid">
        <div
          v-for="site in sites"
          :key="site.name"
          class="card"
          :style="{ background: site.gradient }"
        >
          <div class="card-mockups">
            <div class="mockup mockup-1">
              <div class="mockup-line w70" />
              <div class="mockup-line w50" />
              <div class="mockup-price" />
            </div>
            <div class="mockup mockup-2">
              <div class="mockup-img" />
              <div class="mockup-line w60" />
              <div class="mockup-line w40" />
            </div>
          </div>

          <div class="card-bottom">
            <span class="card-name">{{ site.name }}</span>
            <a :href="site.link" class="card-link" target="_blank" rel="noopener">
              Открыть сайт →
            </a>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { FsHeading, FsText } from '@fastio/public-ui'

type ClientSite = {
  name: string
  gradient: string
  link: string
}

const sites: ClientSite[] = [
  {
    name: 'Шаурма Хаус',
    gradient: 'linear-gradient(135deg, #1a1917, #2a2927)',
    link: '#',
  },
  {
    name: 'Green Café',
    gradient: 'linear-gradient(135deg, #0d3b2e, #1a5c45)',
    link: '#',
  },
  {
    name: 'Лаванда SPA',
    gradient: 'linear-gradient(135deg, #2c1654, #4a2080)',
    link: '#',
  },
]
</script>

<style scoped lang="scss">
.clients-root {
  background: var(--ln-white, #fff);
  padding: var(--section-spacing, 64px) 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ln-accent);
  margin-bottom: 20px;

  &::before {
    content: '';
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--ln-accent);
  }
}

.subtitle {
  margin-top: 12px;
  margin-bottom: 40px;
  max-width: 560px;
}

.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
  width: 100%;
}

.card {
  position: relative;
  border-radius: var(--radius-card, 16px);
  aspect-ratio: 3 / 2;
  padding: 24px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  overflow: hidden;
}

.card-mockups {
  position: absolute;
  top: 20px;
  right: 20px;
  display: flex;
  gap: 12px;
}

.mockup {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  backdrop-filter: blur(4px);
}

.mockup-1 {
  width: 100px;
  transform: rotate(-3deg);
  translate: 0 8px;
}

.mockup-2 {
  width: 90px;
  transform: rotate(2deg);
}

.mockup-line {
  height: 8px;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 4px;

  &.w70 { width: 70%; }
  &.w60 { width: 60%; }
  &.w50 { width: 50%; }
  &.w40 { width: 40%; }
}

.mockup-price {
  width: 40px;
  height: 10px;
  background: rgba(255, 255, 255, 0.35);
  border-radius: 4px;
  margin-top: 2px;
}

.mockup-img {
  width: 100%;
  height: 36px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 6px;
}

.card-bottom {
  position: relative;
  z-index: 1;
}

.card-name {
  display: block;
  font-family: var(--heading-font-family);
  font-size: 20px;
  font-weight: 700;
  color: var(--ln-white, #fff);
  margin-bottom: 4px;
}

.card-link {
  font-family: var(--font-family);
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  text-decoration: none;
  transition: color 0.2s;

  &:hover {
    color: rgba(255, 255, 255, 0.9);
  }
}

@media (min-width: 900px) {
  .container {
    padding: 0 24px;
  }

  .grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .card-name {
    font-size: 22px;
  }
}
</style>
