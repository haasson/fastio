import { shallowReactive, readonly, ref, computed, type Ref } from 'vue'
import type { ModalController, ModalConfig, UseModalsReturn } from '../types/modals'

type ModalInstance = {
  controller: ModalController
  config: Ref<ModalConfig | undefined>
}

type ModalManagerState = {
  modals: Map<string, ModalInstance>
}

const state = shallowReactive<ModalManagerState>({
  modals: new Map(),
})

const configState = shallowReactive<Record<string, ModalConfig | undefined>>({})

const createController = (): ModalController => {
  let resolver: (value: boolean | null) => void

  const isShown = ref(false)

  const open = () => {
    isShown.value = true
    return new Promise<boolean | null>((resolve) => {
      resolver = resolve
    })
  }

  const close = () => { isShown.value = false }
  const decline = () => { close(); resolver(false) }
  const confirm = () => { close(); resolver(true) }
  const dismiss = () => { close(); resolver(null) }

  return { isShown, open, close, decline, confirm, dismiss }
}

const register = (name: string, controller: ModalController): void => {
  if (state.modals.has(name)) {
    console.warn(`[useModals] Modal "${name}" is already registered. Overwriting...`)
  }
  state.modals.set(name, { controller, config: ref(undefined) })
}

const unregister = (name: string): void => {
  state.modals.delete(name)
}

const open = async (name: string, config?: ModalConfig): Promise<boolean | null> => {
  const instance = state.modals.get(name)

  if (!instance) {
    console.error(`[useModals] Modal "${name}" is not registered.`)
    return false
  }

  if (config) {
    instance.config.value = config
    configState[name] = config
  }

  const result = await instance.controller.open()

  instance.config.value = undefined
  configState[name] = undefined

  return result
}

const close = (name: string): void => {
  const instance = state.modals.get(name)

  if (!instance) {
    console.error(`[useModals] Modal "${name}" is not registered.`)
    return
  }

  instance.controller.close()
}

const closeAll = (): void => {
  state.modals.forEach((instance) => {
    if (instance.controller.isShown.value) instance.controller.close()
  })
}

const isOpen = (name: string): boolean =>
  state.modals.get(name)?.controller.isShown.value ?? false

const getOpenModals = (): readonly string[] => {
  const openModals: string[] = []
  state.modals.forEach((instance, name) => {
    if (instance.controller.isShown.value) openModals.push(name)
  })
  return readonly(openModals) as readonly string[]
}

const getModalConfig = (name: string): ModalConfig | undefined =>
  state.modals.get(name)?.config.value

export const modalManager = {
  register,
  unregister,
  getModalConfig,
  createController,
  getOpenModals,
}

export const useModalConfig = (name: string) => computed(() => configState[name])

const useModals = (): UseModalsReturn => ({
  open,
  close,
  closeAll,
  isOpen,
  getStack: getOpenModals,
})

export default useModals
