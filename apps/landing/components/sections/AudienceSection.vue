<template>
  <section class="audience-root">
    <SectionHeader label="Подходит для" muted />


    <div class="tracks">
      <div class="track">
        <div class="marquee">
          <span v-for="(item, i) in [...row1, ...row1, ...row1]" :key="`r1-${i}`" class="tag">{{ item }}</span>
        </div>
      </div>

      <div class="track track-reverse">
        <div class="marquee">
          <span v-for="(item, i) in [...row2, ...row2, ...row2]" :key="`r2-${i}`" class="tag">{{ item }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import SectionHeader from './SectionHeader.vue'

const row1 = [
  'Кафе и рестораны', 'Кальянные', 'Пиццерии', 'Суши-бары', 'Кофейни',
  'Пекарни и кондитерские', 'Бургерные', 'Фастфуд', 'Шаурмичные', 'Столовые',
]

const row2 = [
  'Салоны красоты', 'Барбершопы', 'Ногтевые студии', 'Массажные кабинеты',
  'Фотографы', 'Дизайнеры', 'Репетиторы', 'Частные мастера', 'Тренеры',
  'Цветочные магазины', 'Ремонтные мастерские', 'Психологи',
]
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.audience-root {
  background: var(--ln-surface);
  border-top: 1px solid var(--ln-border);
  border-bottom: 1px solid var(--ln-border);
  padding: 32px 0;
  overflow: hidden;

  :deep(.section-header-root) {
    margin-bottom: 20px;
  }
}

.tracks {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.track {
  overflow: hidden;

  &:hover .marquee {
    animation-play-state: paused;
  }
}

.marquee {
  display: flex;
  gap: 10px;
  width: max-content;
  animation: scroll-left 30s linear infinite;

  .track-reverse & {
    animation-name: scroll-right;
    animation-duration: 35s;
  }
}

.tag {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  padding: 7px 16px;
  border-radius: 40px;
  border: 1px solid var(--ln-border);
  background: var(--ln-black);
  @include text-caption;
  color: rgba(245, 243, 238, 0.6);
  transition: border-color 0.2s, color 0.2s;
  cursor: default;

  &:hover {
    border-color: var(--ln-accent);
    color: var(--ln-white);
  }
}

@keyframes scroll-left {
  from { transform: translateX(0); }
  to   { transform: translateX(-33.333%); }
}

@keyframes scroll-right {
  from { transform: translateX(-33.333%); }
  to   { transform: translateX(0); }
}
</style>
