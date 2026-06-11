import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AuditActor from '../AuditActor.vue'

describe('AuditActor', () => {
  it('рендерит имя и роль', () => {
    const wrapper = mount(AuditActor, {
      props: { name: 'Иван Петров', role: 'Администратор' },
    })

    expect(wrapper.find('[data-testid="actor-name"]').text()).toBe('Иван Петров')
    expect(wrapper.find('[data-testid="actor-role"]').text()).toBe('Администратор')
  })

  it('role null: только имя, роли нет', () => {
    const wrapper = mount(AuditActor, {
      props: { name: 'Иван Петров', role: null },
    })

    expect(wrapper.find('[data-testid="actor-name"]').text()).toBe('Иван Петров')
    expect(wrapper.find('[data-testid="actor-role"]').exists()).toBe(false)
  })

  it('name null: «Система», роли нет даже если передана', () => {
    const wrapper = mount(AuditActor, {
      props: { name: null, role: 'Администратор' },
    })

    expect(wrapper.find('[data-testid="actor-name"]').text()).toBe('Система')
    expect(wrapper.find('[data-testid="actor-role"]').exists()).toBe(false)
  })

  it('email передан: рендерится под именем', () => {
    const wrapper = mount(AuditActor, {
      props: { name: 'Иван Петров', role: 'Администратор', email: 'ivan@example.com' },
    })

    expect(wrapper.find('[data-testid="actor-email"]').text()).toBe('ivan@example.com')
  })

  it('email null: ноды email нет', () => {
    const wrapper = mount(AuditActor, {
      props: { name: 'Иван Петров', role: null, email: null },
    })

    expect(wrapper.find('[data-testid="actor-email"]').exists()).toBe(false)
  })

  it('name null («Система»): email не рендерится даже если передан', () => {
    const wrapper = mount(AuditActor, {
      props: { name: null, role: null, email: 'ghost@example.com' },
    })

    expect(wrapper.find('[data-testid="actor-name"]').text()).toBe('Система')
    expect(wrapper.find('[data-testid="actor-email"]').exists()).toBe(false)
  })
})
