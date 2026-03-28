import { describe, it, expect } from 'vitest'
import { heroContentPositionStyle } from '../utils/heroLayout'

describe('heroContentPositionStyle', () => {
  describe('alignItems — строки', () => {
    it('позиции 1,2,3 → flex-start', () => {
      expect(heroContentPositionStyle(1).alignItems).toBe('flex-start')
      expect(heroContentPositionStyle(2).alignItems).toBe('flex-start')
      expect(heroContentPositionStyle(3).alignItems).toBe('flex-start')
    })

    it('позиции 4,5,6 → center', () => {
      expect(heroContentPositionStyle(4).alignItems).toBe('center')
      expect(heroContentPositionStyle(5).alignItems).toBe('center')
      expect(heroContentPositionStyle(6).alignItems).toBe('center')
    })

    it('позиции 7,8,9 → flex-end', () => {
      expect(heroContentPositionStyle(7).alignItems).toBe('flex-end')
      expect(heroContentPositionStyle(8).alignItems).toBe('flex-end')
      expect(heroContentPositionStyle(9).alignItems).toBe('flex-end')
    })
  })

  describe('justifyContent — колонки', () => {
    it('позиции 1,4,7 → flex-start', () => {
      expect(heroContentPositionStyle(1).justifyContent).toBe('flex-start')
      expect(heroContentPositionStyle(4).justifyContent).toBe('flex-start')
      expect(heroContentPositionStyle(7).justifyContent).toBe('flex-start')
    })

    it('позиции 2,5,8 → center', () => {
      expect(heroContentPositionStyle(2).justifyContent).toBe('center')
      expect(heroContentPositionStyle(5).justifyContent).toBe('center')
      expect(heroContentPositionStyle(8).justifyContent).toBe('center')
    })

    it('позиции 3,6,9 → flex-end', () => {
      expect(heroContentPositionStyle(3).justifyContent).toBe('flex-end')
      expect(heroContentPositionStyle(6).justifyContent).toBe('flex-end')
      expect(heroContentPositionStyle(9).justifyContent).toBe('flex-end')
    })
  })

  it('центр (5) → center / center', () => {
    expect(heroContentPositionStyle(5)).toEqual({ alignItems: 'center', justifyContent: 'center' })
  })

  it('неизвестная позиция → дефолт center / center', () => {
    expect(heroContentPositionStyle(0)).toEqual({ alignItems: 'center', justifyContent: 'center' })
    expect(heroContentPositionStyle(99)).toEqual({ alignItems: 'center', justifyContent: 'center' })
  })
})
