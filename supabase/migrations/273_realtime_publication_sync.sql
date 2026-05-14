-- P1.3d — realtime publication sync с feature manifests.
-- 5 таблиц заявлены в админских manifest'ах как realtime-источники
-- (admin/menu, admin/promotions), но НЕ были добавлены в supabase_realtime
-- публикацию. Эффект — useAddons/useCombos/useModifierGroups/usePromotions/
-- usePromoCodes подписки молча не получают INSERT/UPDATE/DELETE, UI не обновляется
-- при изменениях из других сессий.
--
-- Лишние таблицы в публикации без consumer'а (tenants, tenant_members, order_notes,
-- support_messages, resources, service_branches, dish_branches, combo_branches) —
-- решено НЕ удалять в этой миграции: возможно есть consumer'ы которые аудит
-- не нашёл. Удалим позже после ручной проверки.

ALTER PUBLICATION supabase_realtime ADD TABLE
  public.addons,
  public.combos,
  public.modifier_groups,
  public.promotions,
  public.promo_codes;
