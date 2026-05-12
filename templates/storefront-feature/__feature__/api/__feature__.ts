// Клиентские обёртки над Nitro endpoints `server/api/__feature__/*`.
//
// Storefront почти всегда ходит через серверный слой (а не Supabase напрямую):
//   - RLS и tenant-isolation надёжнее работают на стороне сервера
//   - можно прятать service-role операции
//   - SSR/CSR одинаково
//
// Если фиче не нужен серверный fetch — этот файл можно удалить вместе с api/.

// TODO: вынеси типы в packages/shared/src/types/__feature_camel__.ts если они cross-package
export type __FEATURE_PASCAL__ = {
  id: string
  // TODO: поля
}

export const __FEATURE_CAMEL__Api = {
  async list(): Promise<__FEATURE_PASCAL__[]> {
    return await $fetch<__FEATURE_PASCAL__[]>('/api/__feature__')
  },

  async getById(id: string): Promise<__FEATURE_PASCAL__> {
    return await $fetch<__FEATURE_PASCAL__>(`/api/__feature__/${id}`)
  },
}
