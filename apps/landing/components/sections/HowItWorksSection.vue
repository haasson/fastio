<template>
  <section id="how-it-works" class="how-root">
    <div class="container">
      <span class="label">Как это работает</span>
      <h2 class="heading">Посмотрите как это работает</h2>
      <p class="subtitle">
        Редактор сайта, меню, заказы — всё в одном месте.
        Настраиваете сами, без технических знаний.
      </p>

      <div class="layout">
        <!-- Editor mockup -->
        <div class="mockup">
          <div class="editor-frame">
            <div class="editor-dots"><span /><span /><span /></div>
          </div>
          <div class="editor-body">
            <div class="editor-sidebar">
              <div class="editor-section-label">Палитра</div>
              <div class="palette-row">
                <span class="swatch active" />
                <span class="swatch s2" />
                <span class="swatch s3" />
                <span class="swatch s4" />
              </div>
              <div class="editor-section-label">Блоки страницы</div>
              <div class="block-list">
                <div class="block-item">Шапка</div>
                <div class="block-item">Акции</div>
                <div class="block-item">Меню</div>
                <div class="block-item">О нас</div>
                <div class="block-item">Контакты</div>
              </div>
            </div>
            <div class="editor-preview">
              <div class="preview-header">
                <span class="preview-logo">Шаурма Хаус</span>
              </div>
              <div class="preview-banner" />
              <div class="preview-cards">
                <div class="preview-card" />
                <div class="preview-card" />
                <div class="preview-card" />
              </div>
            </div>
          </div>
        </div>

        <!-- Steps -->
        <div class="steps">
          <div v-for="(step, i) in steps" :key="step.title" class="step">
            <div class="number">{{ i + 1 }}</div>
            <div class="step-content">
              <span class="step-title">{{ step.title }}</span>
              <span class="step-desc">{{ step.desc }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
type Step = {
  title: string
  desc: string
}

const steps: Step[] = [
  {
    title: 'Выбираете палитру или задаёте свои цвета',
    desc: 'Предустановленные темы или полная свобода — задайте любой цвет под ваш брендинг.',
  },
  {
    title: 'Перетаскиваете блоки в нужном порядке',
    desc: 'Шапка, меню, акции, контакты, доставка — добавляете то что нужно, убираете лишнее.',
  },
  {
    title: 'Заполняете меню и запускаете',
    desc: 'Добавляете блюда, фото, описания, цены. Публикуете сайт одной кнопкой.',
  },
]
</script>

<style scoped lang="scss">
.how-root {
  background: var(--ln-black);
  color: var(--ln-white);
  padding: var(--section-spacing) 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 16px;
}

.label {
  display: block;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ln-accent);
  font-weight: 600;
  margin: 0 0 16px;

  &::before {
    content: '●';
    margin-right: 8px;
    font-size: 8px;
    vertical-align: middle;
  }
}

.heading {
  font-family: var(--heading-font-family);
  font-weight: 700;
  font-size: 24px;
  line-height: 1.2;
  margin: 0 0 12px;

  @media (min-width: 768px) {
    font-size: 32px;
  }
}

.subtitle {
  font-size: 16px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.55);
  margin: 0 0 48px;
  max-width: 500px;
}

.layout {
  display: flex;
  flex-direction: column;
  gap: 40px;

  @media (min-width: 1024px) {
    flex-direction: row;
    align-items: flex-start;
    gap: 48px;
  }
}

// Editor mockup
.mockup {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.4);
  flex-shrink: 0;

  @media (min-width: 1024px) {
    width: 50%;
  }
}

.editor-frame {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  background: #2a2927;
}

.editor-dots {
  display: flex;
  gap: 6px;

  span {
    width: 10px;
    height: 10px;
    border-radius: 50%;

    &:nth-child(1) { background: #ff5f57; }
    &:nth-child(2) { background: #febc2e; }
    &:nth-child(3) { background: #28c840; }
  }
}

.editor-body {
  display: flex;
  background: #1a1917;
}

.editor-sidebar {
  width: 120px;
  padding: 14px 12px;
  border-right: 1px solid #2a2927;
  flex-shrink: 0;
}

.editor-section-label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.4);
  margin: 0 0 8px;
}

.palette-row {
  display: flex;
  gap: 6px;
  margin: 0 0 16px;
}

.swatch {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;

  &.active {
    background: var(--ln-accent);
    border-color: var(--ln-accent);
    box-shadow: 0 0 0 2px rgba(229, 90, 37, 0.3);
  }
  &.s2 { background: #3b82f6; }
  &.s3 { background: #8b5cf6; }
  &.s4 { background: #10b981; }
}

.block-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.block-item {
  font-size: 11px;
  padding: 6px 8px;
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.05);
  cursor: default;

  &::before {
    content: '≡';
    margin-right: 6px;
    opacity: 0.4;
  }
}

.editor-preview {
  flex: 1;
  padding: 12px;
  background: #fff;
  min-height: 220px;
}

.preview-header {
  padding: 8px 10px;
  margin: 0 0 8px;
}

.preview-logo {
  font-family: var(--heading-font-family);
  font-weight: 700;
  font-size: 13px;
  color: var(--ln-black);
}

.preview-banner {
  height: 48px;
  background: var(--ln-accent);
  border-radius: 6px;
  margin: 0 0 10px;
}

.preview-cards {
  display: flex;
  gap: 6px;
}

.preview-card {
  flex: 1;
  height: 50px;
  background: #f5f3ee;
  border-radius: 4px;
}

// Steps
.steps {
  display: flex;
  flex-direction: column;
  gap: 32px;

  @media (min-width: 768px) {
    flex: 1;
    gap: 36px;
    padding-top: 8px;
  }
}

.step {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.number {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--ln-accent);
  color: var(--ln-white);
  font-size: 15px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-family: var(--heading-font-family);
}

.step-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 4px;
}

.step-title {
  font-weight: 600;
  font-size: 16px;
  color: var(--ln-white);
}

.step-desc {
  font-size: 14px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.5);
}

@media (min-width: 768px) {
  .container {
    padding: 0 32px;
  }
}
</style>
