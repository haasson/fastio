import { describe, it, expect } from 'vitest'
import { reactive } from 'vue'
import { useFormDirty } from '../ui/useFormDirty'

describe('useFormDirty', () => {
  it('starts clean', () => {
    const form = reactive({ name: 'Vasya', phone: '' })
    const { isDirty } = useFormDirty(form)

    expect(isDirty.value).toBe(false)
  })

  it('becomes dirty on primitive change', () => {
    const form = reactive({ name: 'Vasya', phone: '' })
    const { isDirty } = useFormDirty(form)

    form.name = 'Petya'
    expect(isDirty.value).toBe(true)
  })

  it('becomes dirty on nested object change', () => {
    const form = reactive({ schedule: { open: '10:00', close: '22:00' } })
    const { isDirty } = useFormDirty(form)

    form.schedule.open = '09:00'
    expect(isDirty.value).toBe(true)
  })

  it('returns to clean when value reverted', () => {
    const form = reactive({ name: 'Vasya' })
    const { isDirty } = useFormDirty(form)

    form.name = 'Petya'
    expect(isDirty.value).toBe(true)
    form.name = 'Vasya'
    expect(isDirty.value).toBe(false)
  })

  it('reset() captures new snapshot', () => {
    const form = reactive({ name: 'Vasya' })
    const { isDirty, reset } = useFormDirty(form)

    form.name = 'Petya'
    expect(isDirty.value).toBe(true)
    reset()
    expect(isDirty.value).toBe(false)
  })

  it('detects dirty after reset if form changes again', () => {
    const form = reactive({ name: 'Vasya' })
    const { isDirty, reset } = useFormDirty(form)

    form.name = 'Petya'
    reset()
    form.name = 'Masha'
    expect(isDirty.value).toBe(true)
  })

  it('handles null values', () => {
    const form = reactive<{ email: string | null }>({ email: null })
    const { isDirty } = useFormDirty(form)

    form.email = 'a@b.c'
    expect(isDirty.value).toBe(true)
  })

  it('detects array push/pop', () => {
    const form = reactive<{ tags: string[] }>({ tags: ['a'] })
    const { isDirty, reset } = useFormDirty(form)

    form.tags.push('b')
    expect(isDirty.value).toBe(true)
    form.tags.pop()
    expect(isDirty.value).toBe(false)

    reset()
    form.tags = ['x']
    expect(isDirty.value).toBe(true)
  })

  it('handles Date by value, not reference', () => {
    const form = reactive<{ when: Date }>({ when: new Date('2026-01-01') })
    const { isDirty } = useFormDirty(form)

    form.when = new Date('2026-01-01')
    expect(isDirty.value).toBe(false)

    form.when = new Date('2026-01-02')
    expect(isDirty.value).toBe(true)
  })

  it('handles Map by content', () => {
    const form = reactive<{ m: Map<string, number> }>({ m: new Map([['a', 1]]) })
    const { isDirty, reset } = useFormDirty(form)

    form.m.set('a', 1)
    expect(isDirty.value).toBe(false)

    form.m.set('b', 2)
    expect(isDirty.value).toBe(true)

    reset()
    form.m.delete('b')
    expect(isDirty.value).toBe(true)
  })

  it('handles Set by content', () => {
    const form = reactive<{ s: Set<string> }>({ s: new Set(['a', 'b']) })
    const { isDirty } = useFormDirty(form)

    form.s.add('a')
    expect(isDirty.value).toBe(false)

    form.s.add('c')
    expect(isDirty.value).toBe(true)
  })

  it('handles cyclic references without infinite loop', () => {
    type Node = { name: string; self?: Node }
    const node: Node = { name: 'a' }

    node.self = node

    const form = reactive<Node>(node)
    const { isDirty } = useFormDirty(form)

    expect(isDirty.value).toBe(false)
    form.name = 'b'
    expect(isDirty.value).toBe(true)
  })
})
