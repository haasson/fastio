// Заглушка для vue-router в вайтесте. Настоящий модуль идёт через Nuxt,
// и в тестах impportится только сигнатура. Конкретные спеки мокают
// onBeforeRouteLeave через vi.mock() при необходимости.
export const onBeforeRouteLeave = (_cb: (...args: unknown[]) => unknown) => {}
