import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AuditEntityRef from '../AuditEntityRef.vue'

describe('AuditEntityRef', () => {
  it('имя и тип — раздельные элементы, имя не содержит текст типа', () => {
    const wrapper = mount(AuditEntityRef, {
      props: { entityType: 'dish', entityName: 'Пепперони' },
    })

    const name = wrapper.find('[data-testid="entity-name"]')
    const type = wrapper.find('[data-testid="entity-type"]')

    expect(name.exists()).toBe(true)
    expect(type.exists()).toBe(true)
    expect(name.element).not.toBe(type.element)
    expect(name.text()).toBe('Пепперони')
    expect(name.text()).not.toContain('Блюдо')
    expect(type.text()).toBe('Блюдо')
  })

  it('entityName null: показывает «—»', () => {
    const wrapper = mount(AuditEntityRef, {
      props: { entityType: 'dish', entityName: null },
    })

    expect(wrapper.find('[data-testid="entity-name"]').text()).toBe('—')
  })

  it('branchLabel: чип рендерится только когда передан', () => {
    const withBranch = mount(AuditEntityRef, {
      props: { entityType: 'dish', entityName: 'Пепперони', branchLabel: 'Центральный' },
    })
    const withoutBranch = mount(AuditEntityRef, {
      props: { entityType: 'dish', entityName: 'Пепперони' },
    })

    expect(withBranch.find('[data-testid="entity-branch"]').text()).toContain('Центральный')
    expect(withoutBranch.find('[data-testid="entity-branch"]').exists()).toBe(false)
  })

  it('showType false: элемента типа нет', () => {
    const wrapper = mount(AuditEntityRef, {
      props: { entityType: 'dish', entityName: 'Пепперони', showType: false },
    })

    expect(wrapper.find('[data-testid="entity-type"]').exists()).toBe(false)
  })
})
