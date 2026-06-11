import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AuditChange from '../AuditChange.vue'
import type { RenderedChange } from '../../utils/audit-labels'

const makeChange = (overrides: Partial<RenderedChange> = {}): RenderedChange => ({
  field: 'name',
  label: 'Название',
  oldValue: 'Старое',
  newValue: 'Новое',
  kind: 'text',
  direction: null,
  ...overrides,
})

describe('AuditChange', () => {
  it('kind text: рендерит label, old и new, old зачёркнут', () => {
    const wrapper = mount(AuditChange, {
      props: { change: makeChange() },
    })

    // лейбл без двоеточия: он теперь на отдельной строке
    expect(wrapper.find('[data-testid="change-label"]').text()).toBe('Название')
    expect(wrapper.find('[data-testid="change-old"]').text()).toBe('Старое')
    expect(wrapper.find('[data-testid="change-new"]').text()).toBe('Новое')
    expect(wrapper.find('[data-testid="change-old"]').classes()).toContain('old')
  })

  it('дельта двухэтажная: label и old в разных блочных контейнерах', () => {
    const wrapper = mount(AuditChange, {
      props: { change: makeChange() },
    })

    const label = wrapper.find('[data-testid="change-label"]')
    const old = wrapper.find('[data-testid="change-old"]')

    // регрессия на «всё в одну строку»: значения завёрнуты в блочный .values,
    // лейбл — нет, поэтому old → new падает на вторую строку
    expect(old.element.closest('.values')).not.toBeNull()
    expect(label.element.closest('.values')).toBeNull()
  })

  it('kind price direction up: new имеет класс up', () => {
    const wrapper = mount(AuditChange, {
      props: {
        change: makeChange({ field: 'price', label: 'Цена', oldValue: '100 ₽', newValue: '120 ₽', kind: 'price', direction: 'up' }),
      },
    })

    expect(wrapper.find('[data-testid="change-new"]').classes()).toContain('up')
  })

  it('kind price direction down: new имеет класс down', () => {
    const wrapper = mount(AuditChange, {
      props: {
        change: makeChange({ field: 'price', label: 'Цена', oldValue: '120 ₽', newValue: '100 ₽', kind: 'price', direction: 'down' }),
      },
    })

    expect(wrapper.find('[data-testid="change-new"]').classes()).toContain('down')
  })

  it('kind text не красит new даже при заполненном direction', () => {
    const wrapper = mount(AuditChange, {
      props: {
        change: makeChange({ direction: 'up' }),
      },
    })

    const classes = wrapper.find('[data-testid="change-new"]').classes()

    expect(classes).not.toContain('up')
    expect(classes).not.toContain('down')
  })

  it('kind phrase: только label, без old/new и стрелки', () => {
    const wrapper = mount(AuditChange, {
      props: {
        change: makeChange({ label: 'Перенесено в категорию «Супы»', kind: 'phrase' }),
      },
    })

    expect(wrapper.find('[data-testid="change-label"]').text()).toBe('Перенесено в категорию «Супы»')
    expect(wrapper.find('[data-testid="change-old"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="change-new"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('→')
    // фраза — основной контент строки, не приглушённый префикс-лейбл
    expect(wrapper.find('[data-testid="change-label"]').classes()).toContain('phrase')
  })

  it('kind complex: label и пометка «изменено», без old/new', () => {
    const wrapper = mount(AuditChange, {
      props: {
        change: makeChange({ field: 'conditions', label: 'Условия', kind: 'complex' }),
      },
    })

    // лейбл без двоеточия: он теперь на отдельной строке
    expect(wrapper.find('[data-testid="change-label"]').text()).toBe('Условия')
    expect(wrapper.find('[data-testid="change-note"]').text()).toBe('изменено')
    expect(wrapper.find('[data-testid="change-old"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="change-new"]').exists()).toBe(false)
  })
})
