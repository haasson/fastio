export type HeroGradient = {
  id: string
  label: string
  css: string
}

export const heroGradients: HeroGradient[] = [
  { id: 'diag-bp',    label: 'Диагональ',   css: 'linear-gradient(135deg, var(--color-bg) 0%, var(--primary) 100%)' },
  { id: 'diag-pb',    label: 'Обратная',     css: 'linear-gradient(135deg, var(--primary) 0%, var(--color-bg) 100%)' },
  { id: 'vert-bp',    label: 'Сверху вниз',  css: 'linear-gradient(to bottom, var(--color-bg) 0%, var(--primary) 100%)' },
  { id: 'vert-pb',    label: 'Снизу вверх',  css: 'linear-gradient(to bottom, var(--primary) 0%, var(--color-bg) 100%)' },
  { id: 'horiz-pb',   label: 'Горизонталь',  css: 'linear-gradient(to right, var(--primary) 0%, var(--color-bg) 100%)' },
  { id: 'radial-c',   label: 'Из центра',    css: 'radial-gradient(circle at center, var(--primary) 0%, var(--color-bg) 100%)' },
  { id: 'radial-tl',  label: 'Из угла',      css: 'radial-gradient(circle at top left, var(--primary) 0%, var(--color-bg) 80%)' },
  { id: 'triple',     label: 'Тройной',      css: 'linear-gradient(135deg, var(--primary) 0%, var(--color-surface) 50%, var(--color-bg) 100%)' },
  { id: 'surf-pri',   label: 'Поверхность',  css: 'linear-gradient(135deg, var(--color-surface) 0%, var(--primary) 100%)' },
  { id: 'neutral',    label: 'Нейтральный',  css: 'linear-gradient(135deg, var(--color-bg) 0%, var(--color-surface) 100%)' },
]

export const getHeroGradient = (id: string): HeroGradient | undefined =>
  heroGradients.find((g) => g.id === id)

export const resolveGradientCss = (css: string, palette: { primary: string; bg: string; surface: string }): string =>
  css
    .replaceAll('var(--primary)', palette.primary)
    .replaceAll('var(--color-bg)', palette.bg)
    .replaceAll('var(--color-surface)', palette.surface)
