import { ref, type Ref } from 'vue'

const registry = new Map<string, Ref<boolean>>()

function getOrCreate(name: string): Ref<boolean> {
  if (!registry.has(name)) registry.set(name, ref(false))
  return registry.get(name)!
}

export function useModal(name: string) {
  const isOpen = getOrCreate(name)
  return {
    isOpen,
    open: () => { isOpen.value = true },
    close: () => { isOpen.value = false },
  }
}
