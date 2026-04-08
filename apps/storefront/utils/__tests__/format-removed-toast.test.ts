import { describe, it, expect } from 'vitest'
import { formatRemovedToast } from '../format-removed-toast'

describe('formatRemovedToast', () => {
  it('returns null for empty array', () => {
    expect(formatRemovedToast([])).toBeNull()
  })

  it('shows single dish name', () => {
    expect(formatRemovedToast(['Бургер'])).toBe('Бургер')
  })

  it('shows two dish names', () => {
    expect(formatRemovedToast(['Бургер', 'Пицца'])).toBe('Бургер, Пицца')
  })

  it('shows three dish names', () => {
    expect(formatRemovedToast(['Бургер', 'Пицца', 'Салат'])).toBe('Бургер, Пицца, Салат')
  })

  it('truncates to 3 and shows remainder', () => {
    expect(formatRemovedToast(['A', 'B', 'C', 'D', 'E'])).toBe('A, B, C и ещё 2')
  })

  it('shows "и ещё 1" for 4 items', () => {
    expect(formatRemovedToast(['A', 'B', 'C', 'D'])).toBe('A, B, C и ещё 1')
  })
})
