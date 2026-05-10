import { describe, it, expect } from 'vitest'
import { filterDefined } from '../filterDefined'

describe('filterDefined', () => {
  it('убирает undefined поля', () => {
    const result = filterDefined({ a: 1, b: undefined, c: 'hello' })

    expect(result).toEqual({ a: 1, c: 'hello' })
    expect('b' in result).toBe(false)
  })

  it('оставляет null (явное обнуление)', () => {
    const result = filterDefined({ a: null, b: undefined })

    expect(result).toHaveProperty('a', null)
    expect('b' in result).toBe(false)
  })

  it('оставляет false и 0', () => {
    const result = filterDefined({ active: false, count: 0, skip: undefined })

    expect(result).toEqual({ active: false, count: 0 })
  })

  it('оставляет пустую строку', () => {
    const result = filterDefined({ name: '', skip: undefined })

    expect(result).toHaveProperty('name', '')
  })

  it('пустой объект → пустой объект', () => {
    expect(filterDefined({})).toEqual({})
  })

  it('все поля defined → объект без изменений', () => {
    const input = { a: 1, b: 'x', c: true }

    expect(filterDefined(input)).toEqual(input)
  })

  it('все поля undefined → пустой объект', () => {
    const result = filterDefined({ a: undefined, b: undefined })

    expect(result).toEqual({})
  })
})
