import { describe, it, expect } from 'vitest'
import { getHeroGradient, resolveGradientCss, heroGradients } from '../utils/heroGradients'

const palette = { primary: '#ff0000', bg: '#ffffff', surface: '#f0f0f0' }

describe('getHeroGradient', () => {
  it('возвращает градиент по id', () => {
    const g = getHeroGradient('diag-bp')
    expect(g).toBeDefined()
    expect(g!.id).toBe('diag-bp')
    expect(g!.label).toBe('Диагональ')
  })

  it('неизвестный id → undefined', () => {
    expect(getHeroGradient('nonexistent')).toBeUndefined()
  })

  it('все градиенты доступны по id', () => {
    for (const g of heroGradients) {
      expect(getHeroGradient(g.id)).toBe(g)
    }
  })
})

describe('resolveGradientCss', () => {
  it('заменяет var(--primary)', () => {
    const result = resolveGradientCss('linear-gradient(var(--primary), #000)', palette)
    expect(result).toContain('#ff0000')
    expect(result).not.toContain('var(--primary)')
  })

  it('заменяет var(--color-bg)', () => {
    const result = resolveGradientCss('linear-gradient(var(--color-bg), #000)', palette)
    expect(result).toContain('#ffffff')
    expect(result).not.toContain('var(--color-bg)')
  })

  it('заменяет var(--color-surface)', () => {
    const result = resolveGradientCss('linear-gradient(var(--color-surface), #000)', palette)
    expect(result).toContain('#f0f0f0')
    expect(result).not.toContain('var(--color-surface)')
  })

  it('заменяет все три переменные в одной строке (triple)', () => {
    const triple = getHeroGradient('triple')!
    const result = resolveGradientCss(triple.css, palette)
    expect(result).toContain('#ff0000')
    expect(result).toContain('#ffffff')
    expect(result).toContain('#f0f0f0')
    expect(result).not.toContain('var(')
  })

  it('несколько вхождений одной переменной — все заменяются', () => {
    const css = 'linear-gradient(var(--primary) 0%, var(--primary) 100%)'
    const result = resolveGradientCss(css, palette)
    expect(result).toBe('linear-gradient(#ff0000 0%, #ff0000 100%)')
  })

  it('строка без переменных остаётся неизменной', () => {
    const css = 'linear-gradient(#111, #222)'
    expect(resolveGradientCss(css, palette)).toBe(css)
  })
})
