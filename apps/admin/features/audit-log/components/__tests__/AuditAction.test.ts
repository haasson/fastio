import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AuditAction from '../AuditAction.vue'

describe('AuditAction', () => {
  it('action created: лейбл «Создано» и класс тона success', () => {
    const wrapper = mount(AuditAction, { props: { action: 'created' } })

    expect(wrapper.find('[data-testid="action-label"]').text()).toBe('Создано')
    expect(wrapper.classes()).toContain('success')
  })

  it('action deleted: лейбл «Удалено» и класс тона error', () => {
    const wrapper = mount(AuditAction, { props: { action: 'deleted' } })

    expect(wrapper.find('[data-testid="action-label"]').text()).toBe('Удалено')
    expect(wrapper.classes()).toContain('error')
  })

  it('action updated: лейбл «Изменено» и приглушённый класс primary', () => {
    const wrapper = mount(AuditAction, { props: { action: 'updated' } })

    expect(wrapper.find('[data-testid="action-label"]').text()).toBe('Изменено')
    expect(wrapper.classes()).toContain('primary')
  })

  it('dot: false убирает точку, по умолчанию точка есть', () => {
    const withDot = mount(AuditAction, { props: { action: 'created' } })
    const withoutDot = mount(AuditAction, { props: { action: 'created', dot: false } })

    expect(withDot.find('[data-testid="action-dot"]').exists()).toBe(true)
    expect(withoutDot.find('[data-testid="action-dot"]').exists()).toBe(false)
  })
})
