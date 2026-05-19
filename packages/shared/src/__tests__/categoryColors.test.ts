import { describe, it, expect } from 'vitest'
import {
  getCategoryColorHex,
  getNextCategoryColor,
  DEFAULT_CATEGORY_COLOR_KEY,
  DEFAULT_CATEGORY_COLOR_HEX,
  CATEGORY_COLOR_PALETTE,
} from '../utils/categoryColors'

describe('getCategoryColorHex', () => {
  it('null → null', () => {
    expect(getCategoryColorHex(null)).toBeNull()
  })

  it('undefined → null', () => {
    expect(getCategoryColorHex(undefined)).toBeNull()
  })

  it('пустая строка → null', () => {
    expect(getCategoryColorHex('')).toBeNull()
  })

  it('известный ключ → возвращает hex из палитры', () => {
    const hex = getCategoryColorHex('indigo')

    expect(hex).toBe('#6366f1')
  })

  it('ключ red → hex из палитры', () => {
    const hex = getCategoryColorHex('red')

    expect(hex).toBe('#ef4444')
  })

  it('если передан прямой hex (#RRGGBB) — возвращает его', () => {
    expect(getCategoryColorHex('#ff0000')).toBe('#ff0000')
  })

  it('неизвестный ключ без # → null', () => {
    expect(getCategoryColorHex('nonexistent-color')).toBeNull()
  })
})

describe('DEFAULT_CATEGORY_COLOR_HEX', () => {
  it('соответствует ключу DEFAULT_CATEGORY_COLOR_KEY в палитре', () => {
    const preset = CATEGORY_COLOR_PALETTE.find((p) => p.key === DEFAULT_CATEGORY_COLOR_KEY)

    expect(DEFAULT_CATEGORY_COLOR_HEX).toBe(preset?.hex)
  })
})

describe('getNextCategoryColor', () => {
  it('пустой массив используемых → возвращает первый hex из палитры', () => {
    const next = getNextCategoryColor([])

    expect(next).toBe(CATEGORY_COLOR_PALETTE[0].hex)
  })

  it('если первый цвет занят → возвращает второй', () => {
    const used = [CATEGORY_COLOR_PALETTE[0].hex]
    const next = getNextCategoryColor(used)

    expect(next).toBe(CATEGORY_COLOR_PALETTE[1].hex)
  })

  it('принимает hex-строки из занятых цветов', () => {
    const used = [CATEGORY_COLOR_PALETTE[0].hex, CATEGORY_COLOR_PALETTE[1].hex]
    const next = getNextCategoryColor(used)

    expect(next).toBe(CATEGORY_COLOR_PALETTE[2].hex)
  })

  it('принимает ключи (автоматически резолвит через getCategoryColorHex)', () => {
    // Первый цвет 'red' задан ключом
    const used = [CATEGORY_COLOR_PALETTE[0].key]
    const next = getNextCategoryColor(used)

    // Второй цвет должен быть свободен
    expect(next).toBe(CATEGORY_COLOR_PALETTE[1].hex)
  })

  it('null в массиве игнорируется', () => {
    const next = getNextCategoryColor([null, null])

    // При всех null — первый из палитры
    expect(next).toBe(CATEGORY_COLOR_PALETTE[0].hex)
  })

  it('если все цвета заняты → возвращает первый (wraparound)', () => {
    const usedAll = CATEGORY_COLOR_PALETTE.map((p) => p.hex)
    const next = getNextCategoryColor(usedAll)

    expect(next).toBe(CATEGORY_COLOR_PALETTE[0].hex)
  })
})
