import { describe, it, expect } from 'vitest'
import { isAutoCategory } from '../types/menu'
import type { Category } from '../types/menu'

const makeCategory = (overrides: Partial<Category> = {}): Category => ({
  id: 'cat-1',
  tenantId: 'tenant-1',
  name: 'Бургеры',
  active: true,
  order: 0,
  photoUrl: null,
  useFirstDishPhoto: false,
  type: 'regular',
  tagId: null,
  ...overrides,
})

describe('isAutoCategory', () => {
  it('tagId = null → false (обычная категория)', () => {
    expect(isAutoCategory(makeCategory({ tagId: null }))).toBe(false)
  })

  it('tagId заполнен → true (авто-категория по тегу)', () => {
    expect(isAutoCategory(makeCategory({ tagId: 'tag-1' }))).toBe(true)
  })
})
