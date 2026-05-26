import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ColorSwatch from '../ColorSwatch.vue'

const PRESETS = [
  { value: '#FF0000', color: '#FF0000' },
  { value: '#00FF00', color: '#00FF00' },
]

describe('ColorSwatch', () => {
  it('эмитит update:modelValue при клике на пресет', async () => {
    const wrapper = mount(ColorSwatch, {
      props: { modelValue: '#FF0000', presets: PRESETS },
    })

    await wrapper.findAll('[data-testid="swatch"]')[1].trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['#00FF00'])
  })

  it('показывает кастомный свотч если modelValue не в пресетах', () => {
    const wrapper = mount(ColorSwatch, {
      props: { modelValue: '#AABBCC', presets: PRESETS },
    })

    expect(wrapper.find('[data-testid="custom-swatch"]').exists()).toBe(true)
  })

  it('не показывает кастомный свотч если modelValue в пресетах', () => {
    const wrapper = mount(ColorSwatch, {
      props: { modelValue: '#FF0000', presets: PRESETS },
    })

    expect(wrapper.find('[data-testid="custom-swatch"]').exists()).toBe(false)
  })

  it('показывает кнопку + только при allowCustom', () => {
    const withPlus = mount(ColorSwatch, {
      props: { modelValue: '#FF0000', presets: PRESETS, allowCustom: true },
    })
    const withoutPlus = mount(ColorSwatch, {
      props: { modelValue: '#FF0000', presets: PRESETS },
    })

    expect(withPlus.find('[data-testid="add-btn"]').exists()).toBe(true)
    expect(withoutPlus.find('[data-testid="add-btn"]').exists()).toBe(false)
  })

  it('эмитит add-color и update:modelValue при выборе кастомного цвета', async () => {
    const wrapper = mount(ColorSwatch, {
      props: { modelValue: '#FF0000', presets: PRESETS, allowCustom: true },
    })
    const input = wrapper.find('[data-testid="color-input"]')

    await input.setValue('#123456')
    await input.trigger('change')
    expect(wrapper.emitted('add-color')?.[0]).toEqual(['#123456'])
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['#123456'])
  })

  it('приглушает свотчи из usedValues', () => {
    const wrapper = mount(ColorSwatch, {
      props: { modelValue: '#FF0000', presets: PRESETS, usedValues: ['#00FF00'] },
    })
    const swatches = wrapper.findAll('[data-testid="swatch"]')

    expect(swatches[1].classes()).toContain('used')
  })
})
