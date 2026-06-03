import type { TileSize } from '../types/table'

// Минимальная ширина колонки сетки карточек для каждого размера. Максимум всегда
// 1fr (карточки тянутся, заполняя ряд) — общий пресет для сеток столов и заказов.
export const TILE_SIZE_MIN: Record<TileSize, string> = {
  s: '260px',
  m: '320px',
  l: '400px',
}

// Опции для UiSelect на страницах настроек столов и заказов — единый источник.
export const TILE_SIZE_OPTIONS: { label: string; value: TileSize }[] = [
  { label: 'Компактные', value: 's' },
  { label: 'Средние', value: 'm' },
  { label: 'Крупные', value: 'l' },
]
