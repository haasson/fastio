import { describe, it, expect } from 'vitest'
import { slugify } from '../utils/slugify'

describe('slugify', () => {
  describe('латинские строки', () => {
    it('строчные латинские символы и цифры остаются', () => {
      expect(slugify('hello')).toBe('hello')
    })

    it('прописные переводятся в строчные', () => {
      expect(slugify('Hello World')).toBe('hello-world')
    })

    it('пробелы заменяются дефисами', () => {
      expect(slugify('foo bar baz')).toBe('foo-bar-baz')
    })

    it('несколько пробелов подряд → один дефис', () => {
      expect(slugify('foo  bar')).toBe('foo-bar')
    })
  })

  describe('русские символы', () => {
    it('базовая транслитерация', () => {
      expect(slugify('пицца')).toBe('picca')
    })

    it('ё → e', () => {
      expect(slugify('ёлка')).toBe('elka')
    })

    it('ж → zh', () => {
      expect(slugify('жара')).toBe('zhara')
    })

    it('ш → sh', () => {
      expect(slugify('шаурма')).toBe('shaurma')
    })

    it('щ → sch', () => {
      expect(slugify('щука')).toBe('schuka')
    })

    it('ч → ch', () => {
      expect(slugify('чай')).toBe('chai')
    })

    it('ъ и ь отбрасываются', () => {
      expect(slugify('объект')).toBe('obekt')
      expect(slugify('соль')).toBe('sol')
    })

    it('русские слова с пробелом', () => {
      expect(slugify('горячие блюда')).toBe('goryachie-blyuda')
    })
  })

  describe('спецсимволы', () => {
    it('специальные символы заменяются дефисами', () => {
      expect(slugify('foo!bar')).toBe('foo-bar')
    })

    it('ведущие и завершающие дефисы удаляются', () => {
      expect(slugify(' пицца ')).toBe('picca')
    })

    it('несколько спецсимволов подряд → один дефис', () => {
      expect(slugify('foo---bar')).toBe('foo-bar')
    })

    it('пустая строка → пустая строка', () => {
      expect(slugify('')).toBe('')
    })

    it('числа сохраняются', () => {
      expect(slugify('пицца 4 сыра')).toBe('picca-4-syra')
    })
  })
})
