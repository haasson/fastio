import { getServerSupabase, mapCategory, mapDish } from '../utils/supabase'

export default defineEventHandler(async (event) => {
  const tenantId = event.context.tenantId as string | undefined
  if (!tenantId) throw createError({ statusCode: 404 })

  const supabase = getServerSupabase()

  const [{ data: categoriesData }, { data: dishesData }] = await Promise.all([
    supabase
      .from('categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .order('sort_order'),
    supabase
      .from('dishes')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .order('sort_order'),
  ])

  return {
    categories: (categoriesData ?? []).map(mapCategory),
    dishes: (dishesData ?? []).map(mapDish),
  }
})
