// Test-only stub for Nuxt's virtual `#imports` module.
// Overridden by `vi.mock('#imports', ...)` inside individual tests.
export const useNuxtApp = () => ({ $supabase: null })
export const useRuntimeConfig = () => ({ public: {} })
export const navigateTo = async () => {}
export const defineNuxtPlugin = <T>(fn: T) => fn
