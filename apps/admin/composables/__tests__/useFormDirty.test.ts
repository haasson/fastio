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
})
