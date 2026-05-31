-- =============================================================================
-- FASTIO DEMO SEED — 3 demo tenants for client presentations
-- =============================================================================
-- Owner demo@fastio.app создаётся автоматически если его нет в auth.users.
-- Run via Supabase SQL Editor (with service role) or psql
-- =============================================================================

DO $$
DECLARE
  _owner_id uuid;

  -- Tenant IDs
  t1 uuid := gen_random_uuid(); -- Большая Ложка
  t2 uuid := gen_random_uuid(); -- Дымовая
  t3 uuid := gen_random_uuid(); -- Крафт Бар

  -- ── Tenant 1 vars ──────────────────────────────────────────────────────────
  -- Branch
  t1_branch        uuid := gen_random_uuid();

  -- Categories
  t1_cat_rolls     uuid := gen_random_uuid();
  t1_cat_pizza     uuid := gen_random_uuid();
  t1_cat_burgers   uuid := gen_random_uuid();
  t1_cat_salads    uuid := gen_random_uuid();
  t1_cat_hot       uuid := gen_random_uuid();
  t1_cat_drinks    uuid := gen_random_uuid();
  t1_cat_desserts  uuid := gen_random_uuid();

  -- Modifier groups
  t1_mg_roll_size  uuid := gen_random_uuid();
  t1_mg_pizza_size uuid := gen_random_uuid();
  t1_mg_dough      uuid := gen_random_uuid();

  -- Modifier options
  t1_mo_roll_std   uuid := gen_random_uuid();
  t1_mo_roll_big   uuid := gen_random_uuid();
  t1_mo_pizza_25   uuid := gen_random_uuid();
  t1_mo_pizza_30   uuid := gen_random_uuid();
  t1_mo_pizza_35   uuid := gen_random_uuid();
  t1_mo_dough_cls  uuid := gen_random_uuid();
  t1_mo_dough_thin uuid := gen_random_uuid();
  t1_mo_dough_thick uuid := gen_random_uuid();

  -- Addon preset
  t1_preset_sauces uuid := gen_random_uuid();

  -- Addons
  t1_addon_ketch   uuid := gen_random_uuid();
  t1_addon_mayo    uuid := gen_random_uuid();
  t1_addon_cheese  uuid := gen_random_uuid();
  t1_addon_bbq     uuid := gen_random_uuid();
  t1_addon_spicy   uuid := gen_random_uuid();
  t1_addon_bacon   uuid := gen_random_uuid();
  t1_addon_xcheese uuid := gen_random_uuid();

  -- Tags
  t1_tag_hit       uuid := gen_random_uuid();
  t1_tag_spicy     uuid := gen_random_uuid();
  t1_tag_vegan     uuid := gen_random_uuid();
  t1_tag_new       uuid := gen_random_uuid();
  t1_tag_healthy   uuid := gen_random_uuid();

  -- Dishes – Rolls
  t1_d_philly      uuid := gen_random_uuid();
  t1_d_california  uuid := gen_random_uuid();
  t1_d_dragon      uuid := gen_random_uuid();
  t1_d_yasai       uuid := gen_random_uuid();
  t1_d_spicy_tuna  uuid := gen_random_uuid();

  -- Dishes – Pizza
  t1_d_margherita  uuid := gen_random_uuid();
  t1_d_pepperoni   uuid := gen_random_uuid();
  t1_d_four_cheese uuid := gen_random_uuid();
  t1_d_hawaiian    uuid := gen_random_uuid();
  t1_d_bbq_chicken uuid := gen_random_uuid();

  -- Dishes – Burgers
  t1_d_classic     uuid := gen_random_uuid();
  t1_d_cheese_brg  uuid := gen_random_uuid();
  t1_d_bbq_brg     uuid := gen_random_uuid();
  t1_d_vegan_brg   uuid := gen_random_uuid();
  t1_d_chicken_brg uuid := gen_random_uuid();

  -- Dishes – Salads
  t1_d_caesar      uuid := gen_random_uuid();
  t1_d_greek       uuid := gen_random_uuid();
  t1_d_nicoise     uuid := gen_random_uuid();

  -- Dishes – Hot
  t1_d_carbonara   uuid := gen_random_uuid();
  t1_d_bolognese   uuid := gen_random_uuid();
  t1_d_salmon      uuid := gen_random_uuid();
  t1_d_nuggets     uuid := gen_random_uuid();

  -- Dishes – Drinks
  t1_d_cola        uuid := gen_random_uuid();
  t1_d_juice       uuid := gen_random_uuid();
  t1_d_water       uuid := gen_random_uuid();
  t1_d_lemonade    uuid := gen_random_uuid();
  t1_d_latte       uuid := gen_random_uuid();

  -- Dishes – Desserts
  t1_d_tiramisu    uuid := gen_random_uuid();
  t1_d_cheesecake  uuid := gen_random_uuid();
  t1_d_fondant     uuid := gen_random_uuid();
  t1_d_panna_cotta uuid := gen_random_uuid();

  -- Order statuses t1
  t1_os_new        uuid := gen_random_uuid();
  t1_os_accepted   uuid := gen_random_uuid();
  t1_os_cooking    uuid := gen_random_uuid();
  t1_os_delivering uuid := gen_random_uuid();
  t1_os_done       uuid := gen_random_uuid();
  t1_os_cancelled  uuid := gen_random_uuid();

  -- ── Tenant 2 vars ──────────────────────────────────────────────────────────
  -- Categories
  t2_cat_hookahs   uuid := gen_random_uuid();
  t2_cat_tea       uuid := gen_random_uuid();
  t2_cat_snacks    uuid := gen_random_uuid();
  t2_cat_desserts  uuid := gen_random_uuid();

  -- Modifier groups
  t2_mg_base       uuid := gen_random_uuid();
  t2_mg_heat       uuid := gen_random_uuid();
  t2_mg_tea_size   uuid := gen_random_uuid();

  -- Modifier options
  t2_mo_base_cls   uuid := gen_random_uuid();
  t2_mo_base_milk  uuid := gen_random_uuid();
  t2_mo_base_cool  uuid := gen_random_uuid();
  t2_mo_heat_soft  uuid := gen_random_uuid();
  t2_mo_heat_med   uuid := gen_random_uuid();
  t2_mo_heat_hot   uuid := gen_random_uuid();
  t2_mo_tea_400    uuid := gen_random_uuid();
  t2_mo_tea_700    uuid := gen_random_uuid();
  t2_mo_tea_1000   uuid := gen_random_uuid();

  -- Dishes – Hookahs
  t2_d_two_apples  uuid := gen_random_uuid();
  t2_d_mango_pass  uuid := gen_random_uuid();
  t2_d_blueberry   uuid := gen_random_uuid();
  t2_d_mint_lemon  uuid := gen_random_uuid();
  t2_d_watermelon  uuid := gen_random_uuid();
  t2_d_cola_ice    uuid := gen_random_uuid();
  t2_d_peach_rasp  uuid := gen_random_uuid();

  -- Dishes – Tea & Drinks
  t2_d_chinese_tea uuid := gen_random_uuid();
  t2_d_mango_smth  uuid := gen_random_uuid();
  t2_d_lemonade2   uuid := gen_random_uuid();
  t2_d_mors        uuid := gen_random_uuid();
  t2_d_cocoa       uuid := gen_random_uuid();

  -- Dishes – Snacks
  t2_d_cheese_plat uuid := gen_random_uuid();
  t2_d_meat_plat   uuid := gen_random_uuid();
  t2_d_nuts        uuid := gen_random_uuid();
  t2_d_nachos      uuid := gen_random_uuid();
  t2_d_bruschetta  uuid := gen_random_uuid();

  -- Dishes – Desserts
  t2_d_medovik     uuid := gen_random_uuid();
  t2_d_truffles    uuid := gen_random_uuid();
  t2_d_waffles     uuid := gen_random_uuid();

  -- Order statuses t2
  t2_os_accepted   uuid := gen_random_uuid();
  t2_os_cooking    uuid := gen_random_uuid();
  t2_os_served     uuid := gen_random_uuid();
  t2_os_cancelled  uuid := gen_random_uuid();

  -- Tags t2
  t2_tag_hit       uuid := gen_random_uuid();
  t2_tag_new       uuid := gen_random_uuid();

  -- ── Tenant 3 vars ──────────────────────────────────────────────────────────
  -- Categories
  t3_cat_draft     uuid := gen_random_uuid();
  t3_cat_bottled   uuid := gen_random_uuid();
  t3_cat_cocktails uuid := gen_random_uuid();
  t3_cat_soft      uuid := gen_random_uuid();
  t3_cat_snacks    uuid := gen_random_uuid();
  t3_cat_hot       uuid := gen_random_uuid();
  t3_cat_sets      uuid := gen_random_uuid();

  -- Modifier groups
  t3_mg_volume     uuid := gen_random_uuid();
  t3_mg_ice        uuid := gen_random_uuid();

  -- Modifier options
  t3_mo_vol_300    uuid := gen_random_uuid();
  t3_mo_vol_500    uuid := gen_random_uuid();
  t3_mo_vol_1000   uuid := gen_random_uuid();
  t3_mo_no_ice     uuid := gen_random_uuid();
  t3_mo_with_ice   uuid := gen_random_uuid();

  -- Addon preset
  t3_preset_snacks uuid := gen_random_uuid();

  -- Addons
  t3_addon_chips   uuid := gen_random_uuid();
  t3_addon_crouton uuid := gen_random_uuid();
  t3_addon_nuts    uuid := gen_random_uuid();
  t3_addon_jerky   uuid := gen_random_uuid();

  -- Tags
  t3_tag_hit       uuid := gen_random_uuid();
  t3_tag_new       uuid := gen_random_uuid();
  t3_tag_draft     uuid := gen_random_uuid();

  -- Dishes – Draft
  t3_d_zhig        uuid := gen_random_uuid();
  t3_d_paulaner    uuid := gen_random_uuid();
  t3_d_guinness    uuid := gen_random_uuid();
  t3_d_ipa         uuid := gen_random_uuid();
  t3_d_weizen      uuid := gen_random_uuid();
  t3_d_porter      uuid := gen_random_uuid();
  t3_d_cider       uuid := gen_random_uuid();

  -- Dishes – Bottled
  t3_d_hoegaarden  uuid := gen_random_uuid();
  t3_d_chimay      uuid := gen_random_uuid();
  t3_d_karmeliet   uuid := gen_random_uuid();
  t3_d_duvel       uuid := gen_random_uuid();

  -- Dishes – Cocktails
  t3_d_pina        uuid := gen_random_uuid();
  t3_d_aperol      uuid := gen_random_uuid();
  t3_d_mojito      uuid := gen_random_uuid();
  t3_d_negroni     uuid := gen_random_uuid();
  t3_d_b52         uuid := gen_random_uuid();
  t3_d_whisky_cola uuid := gen_random_uuid();

  -- Dishes – Soft
  t3_d_cola2       uuid := gen_random_uuid();
  t3_d_juice2      uuid := gen_random_uuid();
  t3_d_water2      uuid := gen_random_uuid();
  t3_d_mors2       uuid := gen_random_uuid();

  -- Dishes – Snacks
  t3_d_fries       uuid := gen_random_uuid();
  t3_d_onion_rings uuid := gen_random_uuid();
  t3_d_nuggets2    uuid := gen_random_uuid();
  t3_d_cheese_pl   uuid := gen_random_uuid();
  t3_d_meat_pl     uuid := gen_random_uuid();
  t3_d_brusc       uuid := gen_random_uuid();

  -- Dishes – Hot
  t3_d_bar_burger  uuid := gen_random_uuid();
  t3_d_steak       uuid := gen_random_uuid();
  t3_d_ribs        uuid := gen_random_uuid();

  -- Dishes – Sets
  t3_d_set_friday  uuid := gen_random_uuid();
  t3_d_set_evening uuid := gen_random_uuid();

  -- Order statuses t3
  t3_os_new        uuid := gen_random_uuid();
  t3_os_accepted   uuid := gen_random_uuid();
  t3_os_cooking    uuid := gen_random_uuid();
  t3_os_ready      uuid := gen_random_uuid();
  t3_os_cancelled  uuid := gen_random_uuid();

BEGIN

  -- ============================================================
  -- Cleanup previous run (idempotent)
  -- ============================================================
  DELETE FROM tenants WHERE slug IN ('bolshaya-lozhka', 'dymovaya', 'kraft-bar');


  -- ============================================================
  -- Owner: demo@fastio.app
  -- Создаём если нет — нужно для CI / чистой базы (auth.users пустой после
  -- supabase start). Паттерн скопирован из e2e-staging.sql: password-логин
  -- через GoTrue работает без строки в auth.identities. Пароль здесь дефолтный
  -- для ручных демо-прогонов; e2e globalSetup (scripts/e2e/setup.mjs) ресетит
  -- его на known-good значение.
  -- ============================================================
  SELECT id INTO _owner_id
  FROM auth.users
  WHERE email = 'demo@fastio.app'
  LIMIT 1;

  IF _owner_id IS NULL THEN
    -- Фиксированный UUID — согласован с e2e-ci.sql (demo@fastio.app = ...0001),
    -- чтобы сиды не конфликтовали по unique email при совместном прогоне.
    _owner_id := '00000000-0000-0000-0000-000000000001';

    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      aud,
      role,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      _owner_id,
      '00000000-0000-0000-0000-000000000000',
      'demo@fastio.app',
      crypt('demo-admin-pass-12345', gen_salt('bf')),
      now(),
      'authenticated',
      'authenticated',
      '{"provider": "email", "providers": ["email"]}',
      '{}',
      now(),
      now()
    );
  END IF;


  -- ============================================================
  -- TENANT 1: Вкусно и Точка
  -- Food restaurant — delivery + pickup
  -- ============================================================

  INSERT INTO tenants (
    id, owner_id, name, slug, business_type,
    theme, contacts, working_hours_schedule,
    site_layout, site_content,
    notifications, subscription, modules,
    delivery_min_order, delivery_fee, delivery_description,
    currency, timezone,
    seo, kitchen_config, order_number_config,
    onboarding_completed
  ) VALUES (
    t1, _owner_id,
    'Большая Ложка', 'bolshaya-lozhka', 'food',

    -- theme
    '{"preset":"fresh","primaryColor":"#ff6b35","fontFamily":"system","headingFontFamily":"system","palette":null,"buttonRadius":"rounded","cardRadius":14,"cardShadow":"subtle","customThemes":[],"activeCustomId":null}'::jsonb,

    -- contacts
    '{"phoneMode":"shared","phone":"+7 (900) 123-45-67","email":"hello@bolshaya-lozhka.demo","address":"ул. Ленина, 42, Москва","instagram":"bolshaya_lozhka","vk":"bolshaya_lozhka","telegram":"lozhka_bot","whatsapp":null,"max":null}'::jsonb,

    -- working_hours_schedule
    '{"default":{"open":"10:00","close":"23:00"},"days":{}}'::jsonb,

    -- site_layout
    '{"header":{"showNav":true,"navItems":[{"key":"menu","action":"scroll"},{"key":"delivery","action":"navigate"},{"key":"about","action":"navigate"}],"showPhone":true,"showWorkingHours":true},"sections":{"categoryBar":{"enabled":true,"overflow":"scroll"},"hero":{"enabled":true,"size":"fullscreen","bgType":"gradient","overlayColor":"#000000","overlayOpacity":0.35,"contentPosition":5,"contentAlign":"left","gradientId":"diag-bp"},"banners":{"enabled":true,"displayMode":"auto","autoplay":true,"autoplayInterval":4},"menu":{"enabled":true,"defaultView":"categories","tagDisplayMode":"both"},"gallery":{"enabled":true,"galleryIds":[]},"reviews":{"enabled":false},"delivery":{"enabled":true}},"sectionsOrder":["hero","categoryBar","banners","menu","gallery","delivery"],"pages":["delivery","about"],"pageSettings":{"menu":{"defaultView":"categories","tagDisplayMode":"both"},"delivery":{"showMap":false,"descriptionMode":"auto"},"gallery":{"galleryIds":[]}}}'::jsonb,

    -- site_content
    '{"logo":null,"hero":{"bgUrl":"https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1600&q=80","text":"Роллы, пицца и бургеры — горячие и вовремя 🔥"},"about":{"coverUrl":null,"text":"Мы готовим любимую еду с 2019 года. Свежие ингредиенты, щедрые порции, быстрая доставка по всему городу. Попробуй — и ты поймёшь, почему нас называют «вкусно и точка»."},"delivery":{"manualText":"Доставляем ежедневно с 10:00 до 23:00. Минимальный заказ — 500 ₽. Время доставки — от 40 минут."}}'::jsonb,

    -- notifications
    '{"email":null,"telegramChatId":null}'::jsonb,

    -- subscription
    '{"status":"active","plan":"business","trialEndsAt":null,"renewsAt":"2027-01-01T00:00:00Z","pastDueAt":null,"priceOverride":null,"gracePeriodDays":null}'::jsonb,

    -- modules
    '{"delivery":true,"pickup":true,"modifiers":true,"addons":true,"promotions":true,"combos":false,"customRoles":false,"dineIn":false,"kitchen":true,"reservations":false}'::jsonb,

    500, 150,
    'Бесплатная доставка от 1500 ₽. В зоне 1 — бесплатно. В зоне 2 — 150 ₽. В зоне 3 — 250 ₽.',
    '₽', 'Europe/Moscow',

    -- seo
    '{"metaTitle":"Большая Ложка — доставка еды","metaDescription":"Роллы, пицца, бургеры с доставкой. Быстро, свежо, вкусно!","ogImage":null,"favicon":null,"robots":"index","googleAnalyticsId":null,"yandexMetrikaId":null}'::jsonb,

    -- kitchen_config
    '{"sourceStatusId":null,"completedStatusMap":{"delivery":null,"pickup":null,"dine_in":null}}'::jsonb,

    -- order_number_config
    '{"format":"prefix_counter","scope":"global","prefix":"БЛ","dateFormat":"DDMM","resetPeriod":"daily","padLength":3,"startFrom":1}'::jsonb,

    true
  );


  -- ── T1 Order statuses ────────────────────────────────────────────────────
  INSERT INTO order_statuses (id, tenant_id, name, group_type, position) VALUES
    (t1_os_new,        t1, 'Новый',      'new',         1),
    (t1_os_accepted,   t1, 'Принят',     'in_progress', 2),
    (t1_os_cooking,    t1, 'Готовится',  'in_progress', 3),
    (t1_os_delivering, t1, 'В пути',     'in_progress', 4),
    (t1_os_done,       t1, 'Доставлен',  'completed',   5),
    (t1_os_cancelled,  t1, 'Отменён',    'cancelled',   6);


  -- ── T1 Tags ──────────────────────────────────────────────────────────────
  INSERT INTO dish_tags (id, tenant_id, name, icon, color, sort_order) VALUES
    (t1_tag_hit,     t1, 'Хит',      'fire',    'red',    1),
    (t1_tag_spicy,   t1, 'Острое',   'pepper',  'orange', 2),
    (t1_tag_vegan,   t1, 'Веган',    'leaf',    'green',  3),
    (t1_tag_new,     t1, 'Новинка',  'star',    'blue',   4),
    (t1_tag_healthy, t1, 'Healthy',  'heart',   'teal',   5);


  -- ── T1 Categories ────────────────────────────────────────────────────────
  INSERT INTO categories (id, tenant_id, name, type, sort_order, active) VALUES
    (t1_cat_rolls,    t1, 'Роллы',    'regular', 1, true),
    (t1_cat_pizza,    t1, 'Пицца',    'regular', 2, true),
    (t1_cat_burgers,  t1, 'Бургеры',  'regular', 3, true),
    (t1_cat_salads,   t1, 'Салаты',   'regular', 4, true),
    (t1_cat_hot,      t1, 'Горячее',  'regular', 5, true),
    (t1_cat_drinks,   t1, 'Напитки',  'regular', 6, true),
    (t1_cat_desserts, t1, 'Десерты',  'regular', 7, true);


  -- ── T1 Modifier groups & options ─────────────────────────────────────────
  INSERT INTO modifier_groups (id, tenant_id, name, sort_order, active) VALUES
    (t1_mg_roll_size,  t1, 'Размер',  1, true),
    (t1_mg_pizza_size, t1, 'Диаметр', 2, true),
    (t1_mg_dough,      t1, 'Тесто',   3, true);

  INSERT INTO modifier_options (id, group_id, name, sort_order, active) VALUES
    (t1_mo_roll_std,   t1_mg_roll_size,  'Стандарт (6 шт)',  1, true),
    (t1_mo_roll_big,   t1_mg_roll_size,  'Большой (8 шт)',   2, true),
    (t1_mo_pizza_25,   t1_mg_pizza_size, '25 см',            1, true),
    (t1_mo_pizza_30,   t1_mg_pizza_size, '30 см',            2, true),
    (t1_mo_pizza_35,   t1_mg_pizza_size, '35 см',            3, true),
    (t1_mo_dough_cls,  t1_mg_dough,      'Классическое',     1, true),
    (t1_mo_dough_thin, t1_mg_dough,      'Тонкое',           2, true),
    (t1_mo_dough_thick,t1_mg_dough,      'Пышное',           3, true);


  -- ── T1 Addons ────────────────────────────────────────────────────────────
  INSERT INTO addons (id, tenant_id, name, price, weight, active, sort_order) VALUES
    (t1_addon_ketch,   t1, 'Кетчуп',           49,  30, true, 1),
    (t1_addon_mayo,    t1, 'Майонез',           49,  30, true, 2),
    (t1_addon_cheese,  t1, 'Сырный соус',       69,  40, true, 3),
    (t1_addon_bbq,     t1, 'BBQ соус',          69,  40, true, 4),
    (t1_addon_spicy,   t1, 'Острый соус',       59,  30, true, 5),
    (t1_addon_xcheese, t1, 'Доп. сыр',          89,  20, true, 6),
    (t1_addon_bacon,   t1, 'Бекон',            119,  30, true, 7);

  INSERT INTO addon_presets (id, tenant_id, name, active) VALUES
    (t1_preset_sauces, t1, 'Соусы', true);

  INSERT INTO addon_preset_items (preset_id, addon_id, sort_order) VALUES
    (t1_preset_sauces, t1_addon_ketch,   1),
    (t1_preset_sauces, t1_addon_mayo,    2),
    (t1_preset_sauces, t1_addon_cheese,  3),
    (t1_preset_sauces, t1_addon_bbq,     4),
    (t1_preset_sauces, t1_addon_spicy,   5);


  -- ── T1 Dishes: Rolls ─────────────────────────────────────────────────────
  INSERT INTO dishes (id, tenant_id, category_id, name, description, price, photos, active, sort_order,
    ingredients, nutrition) VALUES
    (t1_d_philly, t1, t1_cat_rolls,
      'Филадельфия',
      'Нежный лосось, сливочный сыр Philadelphia, огурец и авокадо в рисе сорта Koshi-Hikari',
      550, '{}', true, 1,
      '[{"name":"лосось"},{"name":"сливочный сыр"},{"name":"огурец"},{"name":"авокадо"},{"name":"рис"},{"name":"нори"}]'::jsonb,
      '{"calories":320,"protein":14,"fat":12,"carbs":40,"weight":250}'::jsonb),

    (t1_d_california, t1, t1_cat_rolls,
      'Калифорния',
      'Крабовое мясо, авокадо, огурец и икра тобико — классика без которой никуда',
      480, '{}', true, 2,
      '[{"name":"краб"},{"name":"авокадо"},{"name":"огурец"},{"name":"икра тобико"},{"name":"рис"},{"name":"нори"}]'::jsonb,
      '{"calories":290,"protein":12,"fat":9,"carbs":42,"weight":240}'::jsonb),

    (t1_d_dragon, t1, t1_cat_rolls,
      'Дракон',
      'Угорь унаги, авокадо, огурец, политые соусом унаги. Для тех кто знает толк',
      620, '{}', true, 3,
      '[{"name":"угорь"},{"name":"авокадо"},{"name":"огурец"},{"name":"соус унаги"},{"name":"рис"},{"name":"нори"}]'::jsonb,
      '{"calories":380,"protein":18,"fat":14,"carbs":44,"weight":260}'::jsonb),

    (t1_d_yasai, t1, t1_cat_rolls,
      'Ясай Маки',
      'Огурец, авокадо и морковь. Лёгкий вегетарианский ролл — идеально в качестве перекуса',
      350, '{}', true, 4,
      '[{"name":"огурец"},{"name":"авокадо"},{"name":"морковь"},{"name":"рис"},{"name":"нори"}]'::jsonb,
      '{"calories":210,"protein":5,"fat":6,"carbs":35,"weight":220}'::jsonb),

    (t1_d_spicy_tuna, t1, t1_cat_rolls,
      'Острый тунец',
      'Тунец, авокадо и фирменный спайси соус. Для смелых 🌶️',
      520, '{}', true, 5,
      '[{"name":"тунец"},{"name":"авокадо"},{"name":"спайси соус"},{"name":"кунжут"},{"name":"рис"},{"name":"нори"}]'::jsonb,
      '{"calories":310,"protein":16,"fat":10,"carbs":38,"weight":245}'::jsonb);


  -- ── T1 Dishes: Pizza ─────────────────────────────────────────────────────
  INSERT INTO dishes (id, tenant_id, category_id, name, description, price, photos, active, sort_order,
    ingredients, nutrition) VALUES
    (t1_d_margherita, t1, t1_cat_pizza,
      'Маргарита',
      'Томатный соус, моцарелла фиор ди латте, свежий базилик. Итальянская классика навсегда',
      650, '{}', true, 1,
      '[{"name":"томатный соус"},{"name":"моцарелла"},{"name":"базилик"}]'::jsonb,
      '{"calories":720,"protein":32,"fat":24,"carbs":88,"weight":400}'::jsonb),

    (t1_d_pepperoni, t1, t1_cat_pizza,
      'Пепперони',
      'Острая калабрийская салями, моцарелла, томатный соус — хит всех времён',
      750, '{}', true, 2,
      '[{"name":"острая салями"},{"name":"моцарелла"},{"name":"томатный соус"}]'::jsonb,
      '{"calories":860,"protein":38,"fat":32,"carbs":86,"weight":420}'::jsonb),

    (t1_d_four_cheese, t1, t1_cat_pizza,
      '4 Сыра',
      'Моцарелла, чеддер, дор блю и пармезан — квартет из которого не хочется уходить',
      820, '{}', true, 3,
      '[{"name":"моцарелла"},{"name":"чеддер"},{"name":"дор блю"},{"name":"пармезан"},{"name":"сливочный соус"}]'::jsonb,
      '{"calories":940,"protein":42,"fat":38,"carbs":82,"weight":430}'::jsonb),

    (t1_d_hawaiian, t1, t1_cat_pizza,
      'Гавайская',
      'Ветчина, сочный ананас, моцарелла и томатный соус. Да, мы за ананас на пицце',
      720, '{}', true, 4,
      '[{"name":"ветчина"},{"name":"ананас"},{"name":"моцарелла"},{"name":"томатный соус"}]'::jsonb,
      '{"calories":780,"protein":34,"fat":26,"carbs":92,"weight":415}'::jsonb),

    (t1_d_bbq_chicken, t1, t1_cat_pizza,
      'BBQ Курица',
      'Куриное филе, красный лук, моцарелла и дымный BBQ соус. Сочно и сытно',
      780, '{}', true, 5,
      '[{"name":"куриное филе"},{"name":"красный лук"},{"name":"моцарелла"},{"name":"BBQ соус"}]'::jsonb,
      '{"calories":820,"protein":40,"fat":28,"carbs":88,"weight":425}'::jsonb);


  -- ── T1 Dishes: Burgers ───────────────────────────────────────────────────
  INSERT INTO dishes (id, tenant_id, category_id, name, description, price, photos, active, sort_order,
    ingredients, nutrition) VALUES
    (t1_d_classic, t1, t1_cat_burgers,
      'Классик',
      'Сочная говяжья котлета 120г, свежий помидор, лук, салат и фирменный соус',
      490, '{}', true, 1,
      '[{"name":"говяжья котлета"},{"name":"помидор"},{"name":"лук"},{"name":"салат"},{"name":"фирменный соус"},{"name":"булочка"}]'::jsonb,
      '{"calories":540,"protein":28,"fat":22,"carbs":52,"weight":300}'::jsonb),

    (t1_d_cheese_brg, t1, t1_cat_burgers,
      'Чизбургер',
      'Говяжья котлета, плавленый чеддер, маринованный огурец и горчица',
      540, '{}', true, 2,
      '[{"name":"говяжья котлета"},{"name":"чеддер"},{"name":"маринованный огурец"},{"name":"горчица"},{"name":"булочка"}]'::jsonb,
      '{"calories":590,"protein":30,"fat":26,"carbs":50,"weight":310}'::jsonb),

    (t1_d_bbq_brg, t1, t1_cat_burgers,
      'Барбекю',
      'Двойная котлета, хрустящий бекон, карамелизованный лук и дымный BBQ соус',
      620, '{}', true, 3,
      '[{"name":"двойная говяжья котлета"},{"name":"бекон"},{"name":"карамелизованный лук"},{"name":"BBQ соус"},{"name":"чеддер"},{"name":"булочка"}]'::jsonb,
      '{"calories":720,"protein":40,"fat":36,"carbs":54,"weight":380}'::jsonb),

    (t1_d_vegan_brg, t1, t1_cat_burgers,
      'Веган Бургер',
      'Котлета из нута и чечевицы, авокадо, руккола, вяленые томаты и хумус',
      520, '{}', true, 4,
      '[{"name":"котлета из нута"},{"name":"авокадо"},{"name":"руккола"},{"name":"вяленые томаты"},{"name":"хумус"},{"name":"цельнозерновая булочка"}]'::jsonb,
      '{"calories":460,"protein":18,"fat":16,"carbs":58,"weight":290}'::jsonb),

    (t1_d_chicken_brg, t1, t1_cat_burgers,
      'Курица Бургер',
      'Хрустящее куриное филе, домашний коул слоу, маринованный перец и горчичный соус',
      510, '{}', true, 5,
      '[{"name":"куриное филе"},{"name":"коул слоу"},{"name":"маринованный перец"},{"name":"горчичный соус"},{"name":"булочка с кунжутом"}]'::jsonb,
      '{"calories":510,"protein":26,"fat":18,"carbs":56,"weight":320}'::jsonb);


  -- ── T1 Dishes: Salads ────────────────────────────────────────────────────
  INSERT INTO dishes (id, tenant_id, category_id, name, description, price, photos, active, sort_order,
    ingredients, nutrition) VALUES
    (t1_d_caesar, t1, t1_cat_salads,
      'Цезарь с курицей',
      'Хрустящий ромен, куриное филе гриль, пармезан, крутоны и классическая заправка цезарь',
      420, '{}', true, 1,
      '[{"name":"куриное филе"},{"name":"ромен"},{"name":"пармезан"},{"name":"крутоны"},{"name":"соус цезарь"}]'::jsonb,
      '{"calories":380,"protein":28,"fat":16,"carbs":28,"weight":280}'::jsonb),

    (t1_d_greek, t1, t1_cat_salads,
      'Греческий',
      'Помидоры, огурцы, оливки, красный лук, болгарский перец и сыр фета с оливковым маслом',
      380, '{}', true, 2,
      '[{"name":"помидоры"},{"name":"огурцы"},{"name":"оливки"},{"name":"красный лук"},{"name":"болгарский перец"},{"name":"фета"},{"name":"оливковое масло"}]'::jsonb,
      '{"calories":290,"protein":10,"fat":18,"carbs":22,"weight":260}'::jsonb),

    (t1_d_nicoise, t1, t1_cat_salads,
      'Нисуаз',
      'Тунец, яйца, стручковая фасоль, помидоры черри, оливки и анчоусный дрессинг',
      490, '{}', true, 3,
      '[{"name":"тунец"},{"name":"яйца"},{"name":"стручковая фасоль"},{"name":"помидоры черри"},{"name":"оливки"},{"name":"анчоусный дрессинг"}]'::jsonb,
      '{"calories":340,"protein":26,"fat":14,"carbs":20,"weight":270}'::jsonb);


  -- ── T1 Dishes: Hot ───────────────────────────────────────────────────────
  INSERT INTO dishes (id, tenant_id, category_id, name, description, price, photos, active, sort_order,
    ingredients, nutrition) VALUES
    (t1_d_carbonara, t1, t1_cat_hot,
      'Паста Карбонара',
      'Паста тальятелле, яичный желток, бекон гуанчале, пармезан и свежемолотый перец',
      480, '{}', true, 1,
      '[{"name":"тальятелле"},{"name":"бекон"},{"name":"яичный желток"},{"name":"пармезан"},{"name":"чёрный перец"}]'::jsonb,
      '{"calories":620,"protein":28,"fat":24,"carbs":72,"weight":350}'::jsonb),

    (t1_d_bolognese, t1, t1_cat_hot,
      'Паста Болоньезе',
      'Паста ригатони, мясной соус болоньезе, пармезан. Классика итальянской кухни',
      470, '{}', true, 2,
      '[{"name":"ригатони"},{"name":"говядина"},{"name":"помидоры"},{"name":"морковь"},{"name":"сельдерей"},{"name":"пармезан"}]'::jsonb,
      '{"calories":590,"protein":30,"fat":20,"carbs":68,"weight":360}'::jsonb),

    (t1_d_salmon, t1, t1_cat_hot,
      'Стейк из лосося',
      'Стейк лосося 200г на гриле, пюре из сельдерея, соус тартар и лимон',
      890, '{}', true, 3,
      '[{"name":"лосось"},{"name":"сельдерей"},{"name":"соус тартар"},{"name":"лимон"},{"name":"тимьян"}]'::jsonb,
      '{"calories":480,"protein":38,"fat":26,"carbs":18,"weight":320}'::jsonb),

    (t1_d_nuggets, t1, t1_cat_hot,
      'Куриные наггетсы',
      '10 хрустящих наггетсов из куриного филе с соусом на выбор — детский хит',
      350, '{}', true, 4,
      '[{"name":"куриное филе"},{"name":"панировка"},{"name":"соус на выбор"}]'::jsonb,
      '{"calories":420,"protein":24,"fat":18,"carbs":40,"weight":270}'::jsonb);


  -- ── T1 Dishes: Drinks ────────────────────────────────────────────────────
  INSERT INTO dishes (id, tenant_id, category_id, name, description, price, photos, active, sort_order,
    ingredients, nutrition) VALUES
    (t1_d_cola,     t1, t1_cat_drinks, 'Coca-Cola 0.5л',  'Охлаждённая кола в бутылке 0.5л', 150, '{}', true, 1, '[]'::jsonb, '{"calories":210,"protein":0,"fat":0,"carbs":53,"weight":500}'::jsonb),
    (t1_d_juice,    t1, t1_cat_drinks, 'Сок апельсиновый','Натуральный апельсиновый сок 0.3л', 180, '{}', true, 2, '[]'::jsonb, '{"calories":120,"protein":1,"fat":0,"carbs":28,"weight":300}'::jsonb),
    (t1_d_water,    t1, t1_cat_drinks, 'Вода минеральная', 'Газированная минеральная вода 0.5л', 120, '{}', true, 3, '[]'::jsonb, '{"calories":0,"protein":0,"fat":0,"carbs":0,"weight":500}'::jsonb),
    (t1_d_lemonade, t1, t1_cat_drinks, 'Лимонад домашний','Лимонад с мятой и базиликом 0.4л',   220, '{}', true, 4, '[]'::jsonb, '{"calories":160,"protein":0,"fat":0,"carbs":40,"weight":400}'::jsonb),
    (t1_d_latte,    t1, t1_cat_drinks, 'Кофе Латте',       'Эспрессо + молоко. Маленькое удовольствие', 250, '{}', true, 5, '[]'::jsonb, '{"calories":180,"protein":8,"fat":6,"carbs":24,"weight":300}'::jsonb);


  -- ── T1 Dishes: Desserts ──────────────────────────────────────────────────
  INSERT INTO dishes (id, tenant_id, category_id, name, description, price, photos, active, sort_order,
    ingredients, nutrition) VALUES
    (t1_d_tiramisu,    t1, t1_cat_desserts, 'Тирамису',          'Классический итальянский десерт — маскарпоне, савоярди, эспрессо', 320, '{}', true, 1, '[{"name":"маскарпоне"},{"name":"савоярди"},{"name":"эспрессо"},{"name":"какао"}]'::jsonb, '{"calories":420,"protein":8,"fat":20,"carbs":48,"weight":180}'::jsonb),
    (t1_d_cheesecake,  t1, t1_cat_desserts, 'Чизкейк New York', 'Нью-йоркский чизкейк с ягодным соусом — нежный и сливочный',      350, '{}', true, 2, '[{"name":"сливочный сыр"},{"name":"печенье"},{"name":"ягодный соус"}]'::jsonb,        '{"calories":460,"protein":7,"fat":26,"carbs":46,"weight":190}'::jsonb),
    (t1_d_fondant,     t1, t1_cat_desserts, 'Шоколадный фондан','Горячий шоколадный кекс с жидкой начинкой и шариком мороженого',  380, '{}', true, 3, '[{"name":"горький шоколад"},{"name":"масло"},{"name":"яйца"},{"name":"ванильное мороженое"}]'::jsonb, '{"calories":520,"protein":8,"fat":28,"carbs":56,"weight":200}'::jsonb),
    (t1_d_panna_cotta, t1, t1_cat_desserts, 'Панна котта',       'Нежная итальянская панна котта с малиновым кули',                  290, '{}', true, 4, '[{"name":"сливки"},{"name":"желатин"},{"name":"ваниль"},{"name":"малиновый соус"}]'::jsonb, '{"calories":340,"protein":4,"fat":18,"carbs":38,"weight":160}'::jsonb);


  -- ── T1 Link modifiers to dishes ──────────────────────────────────────────

  -- Rolls → size modifier
  INSERT INTO dish_modifier_groups (dish_id, group_id, sort_order) VALUES
    (t1_d_philly,     t1_mg_roll_size, 1),
    (t1_d_california, t1_mg_roll_size, 1),
    (t1_d_dragon,     t1_mg_roll_size, 1),
    (t1_d_yasai,      t1_mg_roll_size, 1),
    (t1_d_spicy_tuna, t1_mg_roll_size, 1);

  INSERT INTO dish_modifier_options (dish_id, option_id, price_delta, is_default, sort_order) VALUES
    (t1_d_philly,     t1_mo_roll_std,  0,   true,  1),
    (t1_d_philly,     t1_mo_roll_big,  200, false, 2),
    (t1_d_california, t1_mo_roll_std,  0,   true,  1),
    (t1_d_california, t1_mo_roll_big,  200, false, 2),
    (t1_d_dragon,     t1_mo_roll_std,  0,   true,  1),
    (t1_d_dragon,     t1_mo_roll_big,  200, false, 2),
    (t1_d_yasai,      t1_mo_roll_std,  0,   true,  1),
    (t1_d_yasai,      t1_mo_roll_big,  200, false, 2),
    (t1_d_spicy_tuna, t1_mo_roll_std,  0,   true,  1),
    (t1_d_spicy_tuna, t1_mo_roll_big,  200, false, 2);

  -- Pizza → size + dough modifiers
  INSERT INTO dish_modifier_groups (dish_id, group_id, sort_order) VALUES
    (t1_d_margherita,  t1_mg_pizza_size, 1),
    (t1_d_margherita,  t1_mg_dough,      2),
    (t1_d_pepperoni,   t1_mg_pizza_size, 1),
    (t1_d_pepperoni,   t1_mg_dough,      2),
    (t1_d_four_cheese, t1_mg_pizza_size, 1),
    (t1_d_four_cheese, t1_mg_dough,      2),
    (t1_d_hawaiian,    t1_mg_pizza_size, 1),
    (t1_d_hawaiian,    t1_mg_dough,      2),
    (t1_d_bbq_chicken, t1_mg_pizza_size, 1),
    (t1_d_bbq_chicken, t1_mg_dough,      2);

  -- Pizza size price deltas (same for all pizzas)
  INSERT INTO dish_modifier_options (dish_id, option_id, price_delta, is_default, sort_order) VALUES
    (t1_d_margherita,  t1_mo_pizza_25,     0,   true,  1),
    (t1_d_margherita,  t1_mo_pizza_30,   150,   false, 2),
    (t1_d_margherita,  t1_mo_pizza_35,   300,   false, 3),
    (t1_d_margherita,  t1_mo_dough_cls,    0,   true,  1),
    (t1_d_margherita,  t1_mo_dough_thin,   0,   false, 2),
    (t1_d_margherita,  t1_mo_dough_thick,  50,  false, 3),
    (t1_d_pepperoni,   t1_mo_pizza_25,     0,   true,  1),
    (t1_d_pepperoni,   t1_mo_pizza_30,   150,   false, 2),
    (t1_d_pepperoni,   t1_mo_pizza_35,   300,   false, 3),
    (t1_d_pepperoni,   t1_mo_dough_cls,    0,   true,  1),
    (t1_d_pepperoni,   t1_mo_dough_thin,   0,   false, 2),
    (t1_d_pepperoni,   t1_mo_dough_thick,  50,  false, 3),
    (t1_d_four_cheese, t1_mo_pizza_25,     0,   true,  1),
    (t1_d_four_cheese, t1_mo_pizza_30,   150,   false, 2),
    (t1_d_four_cheese, t1_mo_pizza_35,   300,   false, 3),
    (t1_d_four_cheese, t1_mo_dough_cls,    0,   true,  1),
    (t1_d_four_cheese, t1_mo_dough_thin,   0,   false, 2),
    (t1_d_four_cheese, t1_mo_dough_thick,  50,  false, 3),
    (t1_d_hawaiian,    t1_mo_pizza_25,     0,   true,  1),
    (t1_d_hawaiian,    t1_mo_pizza_30,   150,   false, 2),
    (t1_d_hawaiian,    t1_mo_pizza_35,   300,   false, 3),
    (t1_d_hawaiian,    t1_mo_dough_cls,    0,   true,  1),
    (t1_d_hawaiian,    t1_mo_dough_thin,   0,   false, 2),
    (t1_d_hawaiian,    t1_mo_dough_thick,  50,  false, 3),
    (t1_d_bbq_chicken, t1_mo_pizza_25,     0,   true,  1),
    (t1_d_bbq_chicken, t1_mo_pizza_30,   150,   false, 2),
    (t1_d_bbq_chicken, t1_mo_pizza_35,   300,   false, 3),
    (t1_d_bbq_chicken, t1_mo_dough_cls,    0,   true,  1),
    (t1_d_bbq_chicken, t1_mo_dough_thin,   0,   false, 2),
    (t1_d_bbq_chicken, t1_mo_dough_thick,  50,  false, 3);

  -- Burgers → addons (xcheese, bacon)
  INSERT INTO dish_addons (dish_id, addon_id, sort_order) VALUES
    (t1_d_classic,    t1_addon_ketch,   1),
    (t1_d_classic,    t1_addon_mayo,    2),
    (t1_d_classic,    t1_addon_xcheese, 3),
    (t1_d_classic,    t1_addon_bacon,   4),
    (t1_d_cheese_brg, t1_addon_ketch,   1),
    (t1_d_cheese_brg, t1_addon_mayo,    2),
    (t1_d_cheese_brg, t1_addon_bacon,   3),
    (t1_d_bbq_brg,    t1_addon_xcheese, 1),
    (t1_d_bbq_brg,    t1_addon_bacon,   2),
    (t1_d_vegan_brg,  t1_addon_ketch,   1),
    (t1_d_chicken_brg,t1_addon_ketch,   1),
    (t1_d_chicken_brg,t1_addon_mayo,    2),
    (t1_d_nuggets,    t1_addon_ketch,   1),
    (t1_d_nuggets,    t1_addon_mayo,    2),
    (t1_d_nuggets,    t1_addon_cheese,  3),
    (t1_d_nuggets,    t1_addon_bbq,     4),
    (t1_d_nuggets,    t1_addon_spicy,   5);


  -- ── T1 Tag assignments ───────────────────────────────────────────────────
  INSERT INTO dish_tag_assignments (dish_id, tag_id, tenant_id, sort_order) VALUES
    (t1_d_philly,     t1_tag_hit,     t1, 1),
    (t1_d_dragon,     t1_tag_hit,     t1, 1),
    (t1_d_dragon,     t1_tag_new,     t1, 2),
    (t1_d_spicy_tuna, t1_tag_spicy,   t1, 1),
    (t1_d_yasai,      t1_tag_vegan,   t1, 1),
    (t1_d_yasai,      t1_tag_healthy, t1, 2),
    (t1_d_pepperoni,  t1_tag_hit,     t1, 1),
    (t1_d_pepperoni,  t1_tag_spicy,   t1, 2),
    (t1_d_four_cheese,t1_tag_hit,     t1, 1),
    (t1_d_bbq_brg,    t1_tag_hit,     t1, 1),
    (t1_d_vegan_brg,  t1_tag_vegan,   t1, 1),
    (t1_d_vegan_brg,  t1_tag_healthy, t1, 2),
    (t1_d_salmon,     t1_tag_healthy, t1, 1),
    (t1_d_salmon,     t1_tag_new,     t1, 2),
    (t1_d_nicoise,    t1_tag_healthy, t1, 1);


  -- ── T1 Branch (required for delivery zones) ─────────────────────────────
  INSERT INTO branches (id, tenant_id, name, address, phone, is_active,
    working_hours, delivery_min_order, delivery_fee)
  VALUES (t1_branch, t1, 'Основной', 'ул. Ленина, 42, Москва', '+7 (900) 123-45-67', true,
    '{"default":{"open":"10:00","close":"23:00"},"days":{}}'::jsonb, 500, 150);


  -- ── T1 Delivery zones (around Moscow center) ─────────────────────────────
  INSERT INTO delivery_zones (id, tenant_id, branch_id, name, color, coordinates,
    delivery_fee, min_order, free_delivery_from, sort_order, is_active) VALUES
    (gen_random_uuid(), t1, t1_branch, 'Зона 1 — Центр',    '#22c55e',
     '[[37.56,55.77],[37.66,55.77],[37.66,55.73],[37.56,55.73],[37.56,55.77]]'::jsonb,
     0, 500, 0, 1, true),
    (gen_random_uuid(), t1, t1_branch, 'Зона 2 — Ближняя',  '#f59e0b',
     '[[37.52,55.80],[37.70,55.80],[37.70,55.70],[37.52,55.70],[37.52,55.80]]'::jsonb,
     150, 700, 1500, 2, true),
    (gen_random_uuid(), t1, t1_branch, 'Зона 3 — Дальняя',  '#ef4444',
     '[[37.46,55.84],[37.76,55.84],[37.76,55.66],[37.46,55.66],[37.46,55.84]]'::jsonb,
     250, 1000, 2000, 3, true);


  -- ── T1 Promotions ────────────────────────────────────────────────────────
  INSERT INTO promotions (id, tenant_id, title, description, type, discount_type,
    discount_value, branch_ids, conditions, active) VALUES
    (gen_random_uuid(), t1,
      'Первый заказ — 10% скидка',
      'Скидка 10% на первый заказ для новых клиентов',
      'first_order', 'percent', 10, '{}', '{}'::jsonb, true),
    (gen_random_uuid(), t1,
      'Бесплатная доставка',
      'При заказе от 1500 ₽ доставка бесплатно',
      'min_order', 'fixed', 150, '{}',
      '{"minOrderAmount": 1500}'::jsonb, true);


  -- ── T1 Gallery ───────────────────────────────────────────────────────────
  INSERT INTO galleries (id, tenant_id, name, title, description, autoplay, autoplay_interval, sort_order)
  VALUES (gen_random_uuid(), t1, 'Наша кухня', 'Как мы готовим', 'Загляните на нашу кухню', true, 4, 1);


  -- ============================================================
  -- TENANT 2: Дым и Уют
  -- Hookah lounge — dine-in + reservations only
  -- ============================================================

  INSERT INTO tenants (
    id, owner_id, name, slug, business_type,
    theme, contacts, working_hours_schedule,
    site_layout, site_content,
    notifications, subscription, modules,
    delivery_min_order, delivery_fee, delivery_description,
    currency, timezone,
    seo, kitchen_config, order_number_config,
    onboarding_completed
  ) VALUES (
    t2, _owner_id,
    'Дымовая', 'dymovaya', 'food',

    -- theme: dark velvet
    '{"preset":"velvet","primaryColor":"#9333ea","fontFamily":"system","headingFontFamily":"system","palette":null,"buttonRadius":"pill","cardRadius":16,"cardShadow":"medium","customThemes":[],"activeCustomId":null}'::jsonb,

    -- contacts
    '{"phoneMode":"shared","phone":"+7 (900) 765-43-21","email":"hello@dymovaya.demo","address":"ул. Пушкина, 15, Москва","instagram":"dymovaya_bar","vk":null,"telegram":"dymovaya_bot","whatsapp":"+79007654321","max":null}'::jsonb,

    -- working_hours_schedule: weekdays 14-02, weekends 14-04
    '{"default":{"open":"14:00","close":"02:00"},"days":{"5":{"open":"14:00","close":"04:00"},"6":{"open":"14:00","close":"04:00"},"7":{"open":"14:00","close":"04:00"}}}'::jsonb,

    -- site_layout
    '{"header":{"showNav":true,"navItems":[{"key":"menu","action":"scroll"},{"key":"about","action":"navigate"}],"showPhone":true,"showWorkingHours":true},"sections":{"categoryBar":{"enabled":true,"overflow":"scroll"},"hero":{"enabled":true,"size":"fullscreen","bgType":"gradient","overlayColor":"#1a0030","overlayOpacity":0.6,"contentPosition":5,"contentAlign":"center","gradientId":"diag-bp"},"banners":{"enabled":false,"displayMode":"single","autoplay":false,"autoplayInterval":4},"menu":{"enabled":true,"defaultView":"categories","tagDisplayMode":"both"},"gallery":{"enabled":true,"galleryIds":[]},"reviews":{"enabled":false},"delivery":{"enabled":false}},"sectionsOrder":["hero","categoryBar","menu","gallery"],"pages":["about"],"pageSettings":{"menu":{"defaultView":"categories","tagDisplayMode":"both"},"delivery":{"showMap":false,"descriptionMode":"auto"},"gallery":{"galleryIds":[]}}}'::jsonb,

    -- site_content
    '{"logo":null,"hero":{"bgUrl":"https://images.unsplash.com/photo-1572116469696-31de0f17cc34?auto=format&fit=crop&w=1600&q=80","text":"Настоящий кальян. Без лишних слов 🌙"},"about":{"coverUrl":null,"text":"Дымовая — кальянная с характером. Премиальный табак, авторские миксы, живая музыка по выходным. Приходи один или с компанией — место найдётся."},"delivery":{"manualText":""}}'::jsonb,

    '{"email":null,"telegramChatId":null}'::jsonb,

    '{"status":"active","plan":"business","trialEndsAt":null,"renewsAt":"2027-01-01T00:00:00Z","pastDueAt":null,"priceOverride":null,"gracePeriodDays":null}'::jsonb,

    -- modules: dineIn + reservations + modifiers
    '{"delivery":false,"pickup":false,"modifiers":true,"addons":false,"promotions":false,"combos":false,"customRoles":false,"dineIn":true,"kitchen":false,"reservations":true}'::jsonb,

    0, 0, '',
    '₽', 'Europe/Moscow',

    '{"metaTitle":"Дымовая — кальянная","metaDescription":"Премиальные кальяны, авторские миксы, живая музыка. Бронируй столик онлайн.","ogImage":null,"favicon":null,"robots":"index","googleAnalyticsId":null,"yandexMetrikaId":null}'::jsonb,
    '{"sourceStatusId":null,"completedStatusMap":{"delivery":null,"pickup":null,"dine_in":null}}'::jsonb,
    '{"format":"counter","scope":"global","prefix":"","dateFormat":"DDMM","resetPeriod":"daily","padLength":3,"startFrom":1}'::jsonb,
    true
  );


  -- ── T2 Order statuses ────────────────────────────────────────────────────
  INSERT INTO order_statuses (id, tenant_id, name, group_type, position) VALUES
    (t2_os_accepted,  t2, 'Принят',    'new',         1),
    (t2_os_cooking,   t2, 'Готовится', 'in_progress', 2),
    (t2_os_served,    t2, 'Подан',     'completed',   3),
    (t2_os_cancelled, t2, 'Отменён',   'cancelled',   4);


  -- ── T2 Tags ──────────────────────────────────────────────────────────────
  INSERT INTO dish_tags (id, tenant_id, name, icon, color, sort_order) VALUES
    (t2_tag_hit,  t2, 'Хит',    'fire', 'red',  1),
    (t2_tag_new,  t2, 'Новинка','star', 'blue', 2);


  -- ── T2 Categories ────────────────────────────────────────────────────────
  INSERT INTO categories (id, tenant_id, name, type, sort_order, active) VALUES
    (t2_cat_hookahs,  t2, 'Кальяны',          'regular', 1, true),
    (t2_cat_tea,      t2, 'Чай и напитки',     'regular', 2, true),
    (t2_cat_snacks,   t2, 'Снеки и нарезки',   'regular', 3, true),
    (t2_cat_desserts, t2, 'Десерты',           'regular', 4, true);


  -- ── T2 Modifier groups & options ─────────────────────────────────────────
  INSERT INTO modifier_groups (id, tenant_id, name, sort_order, active) VALUES
    (t2_mg_base,     t2, 'Основа',       1, true),
    (t2_mg_heat,     t2, 'Жар',          2, true),
    (t2_mg_tea_size, t2, 'Объём чая',    3, true);

  INSERT INTO modifier_options (id, group_id, name, sort_order, active) VALUES
    (t2_mo_base_cls,  t2_mg_base,     'Классическая',         1, true),
    (t2_mo_base_milk, t2_mg_base,     'Молочная',             2, true),
    (t2_mo_base_cool, t2_mg_base,     'С охладителем',        3, true),
    (t2_mo_heat_soft, t2_mg_heat,     'Лёгкий',               1, true),
    (t2_mo_heat_med,  t2_mg_heat,     'Средний',              2, true),
    (t2_mo_heat_hot,  t2_mg_heat,     'Крепкий',              3, true),
    (t2_mo_tea_400,   t2_mg_tea_size, '400 мл',               1, true),
    (t2_mo_tea_700,   t2_mg_tea_size, '700 мл (чайник)',      2, true),
    (t2_mo_tea_1000,  t2_mg_tea_size, '1000 мл (большой)',    3, true);


  -- ── T2 Dishes: Hookahs ───────────────────────────────────────────────────
  INSERT INTO dishes (id, tenant_id, category_id, name, description, price, photos, active, sort_order,
    ingredients, nutrition) VALUES
    (t2_d_two_apples, t2, t2_cat_hookahs, 'Два Яблока',      'Классический яблочный миксбленд — вечная классика для любой компании', 1200, '{}', true, 1, '[]'::jsonb, '{}'::jsonb),
    (t2_d_mango_pass, t2, t2_cat_hookahs, 'Манго-Маракуйя',  'Сочный тропический дуэт — сладкий манго и кислинка маракуйи',         1350, '{}', true, 2, '[]'::jsonb, '{}'::jsonb),
    (t2_d_blueberry,  t2, t2_cat_hookahs, 'Черничный Йогурт','Кремовая черника с нотками йогурта. Мягко и незабываемо',              1400, '{}', true, 3, '[]'::jsonb, '{}'::jsonb),
    (t2_d_mint_lemon, t2, t2_cat_hookahs, 'Мятный Лимон',    'Свежая мята + кислинка лимона. Самый освежающий вариант в нашем меню', 1300, '{}', true, 4, '[]'::jsonb, '{}'::jsonb),
    (t2_d_watermelon, t2, t2_cat_hookahs, 'Арбуз со Льдом',  'Летний арбузный фреш с ледяной прохладой — хит сезона',               1350, '{}', true, 5, '[]'::jsonb, '{}'::jsonb),
    (t2_d_cola_ice,   t2, t2_cat_hookahs, 'Кола на Льду',    'Узнаваемый вкус колы с освежающим льдом — барная классика',            1250, '{}', true, 6, '[]'::jsonb, '{}'::jsonb),
    (t2_d_peach_rasp, t2, t2_cat_hookahs, 'Персик-Малина',   'Спелый персик и сочная малина — нежный летний букет',                  1400, '{}', true, 7, '[]'::jsonb, '{}'::jsonb);

  -- Attach base + heat modifiers to all hookahs
  INSERT INTO dish_modifier_groups (dish_id, group_id, sort_order) VALUES
    (t2_d_two_apples, t2_mg_base, 1), (t2_d_two_apples, t2_mg_heat, 2),
    (t2_d_mango_pass, t2_mg_base, 1), (t2_d_mango_pass, t2_mg_heat, 2),
    (t2_d_blueberry,  t2_mg_base, 1), (t2_d_blueberry,  t2_mg_heat, 2),
    (t2_d_mint_lemon, t2_mg_base, 1), (t2_d_mint_lemon, t2_mg_heat, 2),
    (t2_d_watermelon, t2_mg_base, 1), (t2_d_watermelon, t2_mg_heat, 2),
    (t2_d_cola_ice,   t2_mg_base, 1), (t2_d_cola_ice,   t2_mg_heat, 2),
    (t2_d_peach_rasp, t2_mg_base, 1), (t2_d_peach_rasp, t2_mg_heat, 2);

  INSERT INTO dish_modifier_options (dish_id, option_id, price_delta, is_default, sort_order) VALUES
    (t2_d_two_apples, t2_mo_base_cls,   0,   true,  1),
    (t2_d_two_apples, t2_mo_base_milk, 100,  false, 2),
    (t2_d_two_apples, t2_mo_base_cool, 150,  false, 3),
    (t2_d_two_apples, t2_mo_heat_soft,  0,   false, 1),
    (t2_d_two_apples, t2_mo_heat_med,   0,   true,  2),
    (t2_d_two_apples, t2_mo_heat_hot,   0,   false, 3),
    (t2_d_mango_pass, t2_mo_base_cls,   0,   true,  1),
    (t2_d_mango_pass, t2_mo_base_milk, 100,  false, 2),
    (t2_d_mango_pass, t2_mo_base_cool, 150,  false, 3),
    (t2_d_mango_pass, t2_mo_heat_soft,  0,   false, 1),
    (t2_d_mango_pass, t2_mo_heat_med,   0,   true,  2),
    (t2_d_mango_pass, t2_mo_heat_hot,   0,   false, 3),
    (t2_d_blueberry,  t2_mo_base_cls,   0,   true,  1),
    (t2_d_blueberry,  t2_mo_base_milk, 100,  false, 2),
    (t2_d_blueberry,  t2_mo_base_cool, 150,  false, 3),
    (t2_d_blueberry,  t2_mo_heat_soft,  0,   false, 1),
    (t2_d_blueberry,  t2_mo_heat_med,   0,   true,  2),
    (t2_d_blueberry,  t2_mo_heat_hot,   0,   false, 3),
    (t2_d_mint_lemon, t2_mo_base_cls,   0,   true,  1),
    (t2_d_mint_lemon, t2_mo_base_milk, 100,  false, 2),
    (t2_d_mint_lemon, t2_mo_base_cool, 150,  false, 3),
    (t2_d_mint_lemon, t2_mo_heat_soft,  0,   false, 1),
    (t2_d_mint_lemon, t2_mo_heat_med,   0,   true,  2),
    (t2_d_mint_lemon, t2_mo_heat_hot,   0,   false, 3),
    (t2_d_watermelon, t2_mo_base_cls,   0,   true,  1),
    (t2_d_watermelon, t2_mo_base_milk, 100,  false, 2),
    (t2_d_watermelon, t2_mo_base_cool, 150,  false, 3),
    (t2_d_watermelon, t2_mo_heat_soft,  0,   false, 1),
    (t2_d_watermelon, t2_mo_heat_med,   0,   true,  2),
    (t2_d_watermelon, t2_mo_heat_hot,   0,   false, 3),
    (t2_d_cola_ice,   t2_mo_base_cls,   0,   true,  1),
    (t2_d_cola_ice,   t2_mo_base_milk, 100,  false, 2),
    (t2_d_cola_ice,   t2_mo_base_cool, 150,  false, 3),
    (t2_d_cola_ice,   t2_mo_heat_soft,  0,   false, 1),
    (t2_d_cola_ice,   t2_mo_heat_med,   0,   true,  2),
    (t2_d_cola_ice,   t2_mo_heat_hot,   0,   false, 3),
    (t2_d_peach_rasp, t2_mo_base_cls,   0,   true,  1),
    (t2_d_peach_rasp, t2_mo_base_milk, 100,  false, 2),
    (t2_d_peach_rasp, t2_mo_base_cool, 150,  false, 3),
    (t2_d_peach_rasp, t2_mo_heat_soft,  0,   false, 1),
    (t2_d_peach_rasp, t2_mo_heat_med,   0,   true,  2),
    (t2_d_peach_rasp, t2_mo_heat_hot,   0,   false, 3);


  -- ── T2 Dishes: Tea & Drinks ──────────────────────────────────────────────
  INSERT INTO dishes (id, tenant_id, category_id, name, description, price, photos, active, sort_order,
    ingredients, nutrition) VALUES
    (t2_d_chinese_tea, t2, t2_cat_tea, 'Китайский чай',   'Коллекция улунов, пуэров и зелёных чаёв. Выбери своё настроение',     450, '{}', true, 1, '[]'::jsonb, '{}'::jsonb),
    (t2_d_mango_smth,  t2, t2_cat_tea, 'Манго смузи',     'Свежий манго, банан и кокосовое молоко — гладкий и насыщенный',        350, '{}', true, 2, '[]'::jsonb, '{}'::jsonb),
    (t2_d_lemonade2,   t2, t2_cat_tea, 'Лимонад',         'Домашний лимонад с мятой, лимоном и имбирём',                          280, '{}', true, 3, '[]'::jsonb, '{}'::jsonb),
    (t2_d_mors,        t2, t2_cat_tea, 'Морс домашний',   'Морс из лесных ягод — натурально и вкусно',                            250, '{}', true, 4, '[]'::jsonb, '{}'::jsonb),
    (t2_d_cocoa,       t2, t2_cat_tea, 'Какао',           'Бельгийское горячее какао со взбитыми сливками',                       300, '{}', true, 5, '[]'::jsonb, '{}'::jsonb);

  -- Attach tea size modifier to chinese tea
  INSERT INTO dish_modifier_groups (dish_id, group_id, sort_order) VALUES (t2_d_chinese_tea, t2_mg_tea_size, 1);
  INSERT INTO dish_modifier_options (dish_id, option_id, price_delta, is_default, sort_order) VALUES
    (t2_d_chinese_tea, t2_mo_tea_400,    0,   true,  1),
    (t2_d_chinese_tea, t2_mo_tea_700,  100,   false, 2),
    (t2_d_chinese_tea, t2_mo_tea_1000, 200,   false, 3);


  -- ── T2 Dishes: Snacks ────────────────────────────────────────────────────
  INSERT INTO dishes (id, tenant_id, category_id, name, description, price, photos, active, sort_order,
    ingredients, nutrition) VALUES
    (t2_d_cheese_plat, t2, t2_cat_snacks, 'Сырная нарезка',  'Ассорти из 5 сортов сыра с мёдом и орехами',               650, '{}', true, 1, '[]'::jsonb, '{}'::jsonb),
    (t2_d_meat_plat,   t2, t2_cat_snacks, 'Мясная нарезка',  'Прошутто, салями, брезаола с горчицей и корнишонами',       750, '{}', true, 2, '[]'::jsonb, '{}'::jsonb),
    (t2_d_nuts,        t2, t2_cat_snacks, 'Орехи ассорти',   'Кешью, миндаль, фундук, грецкий орех — жареные с солью',    350, '{}', true, 3, '[]'::jsonb, '{}'::jsonb),
    (t2_d_nachos,      t2, t2_cat_snacks, 'Начос с соусами', 'Хрустящие начос с сальсой, гуакамоле и сырным соусом',      380, '{}', true, 4, '[]'::jsonb, '{}'::jsonb),
    (t2_d_bruschetta,  t2, t2_cat_snacks, 'Брускетты',       '4 брускетты: томат+базилик, авокадо, лосось, грибы',        420, '{}', true, 5, '[]'::jsonb, '{}'::jsonb);


  -- ── T2 Dishes: Desserts ──────────────────────────────────────────────────
  INSERT INTO dishes (id, tenant_id, category_id, name, description, price, photos, active, sort_order,
    ingredients, nutrition) VALUES
    (t2_d_medovik,   t2, t2_cat_desserts, 'Медовик',             'Нежный медовый торт со сметанным кремом — бабушкин рецепт',     380, '{}', true, 1, '[]'::jsonb, '{}'::jsonb),
    (t2_d_truffles,  t2, t2_cat_desserts, 'Шоколадные трюфели', '5 ручных трюфелей из тёмного бельгийского шоколада',            320, '{}', true, 2, '[]'::jsonb, '{}'::jsonb),
    (t2_d_waffles,   t2, t2_cat_desserts, 'Вафли бельгийские',  'Хрустящие вафли с ягодами, мороженым и сиропом',                340, '{}', true, 3, '[]'::jsonb, '{}'::jsonb);


  -- ── T2 Tag assignments ───────────────────────────────────────────────────
  INSERT INTO dish_tag_assignments (dish_id, tag_id, tenant_id, sort_order) VALUES
    (t2_d_two_apples, t2_tag_hit,  t2, 1),
    (t2_d_watermelon, t2_tag_hit,  t2, 1),
    (t2_d_peach_rasp, t2_tag_new,  t2, 1),
    (t2_d_blueberry,  t2_tag_new,  t2, 1);


  -- ── T2 Tables ────────────────────────────────────────────────────────────
  INSERT INTO tables (id, tenant_id, name, is_open, is_active, capacity, tags, shape, table_width, table_height, rotation) VALUES
    (gen_random_uuid(), t2, 'VIP Зал 1',   false, true, 6, '{"vip"}',      'rectangle', 140, 80, 0),
    (gen_random_uuid(), t2, 'VIP Зал 2',   false, true, 6, '{"vip"}',      'rectangle', 140, 80, 0),
    (gen_random_uuid(), t2, 'Диван 1',     false, true, 4, '{"lounge"}',   'rectangle', 120, 70, 0),
    (gen_random_uuid(), t2, 'Диван 2',     false, true, 4, '{"lounge"}',   'rectangle', 120, 70, 0),
    (gen_random_uuid(), t2, 'Диван 3',     false, true, 4, '{"lounge"}',   'rectangle', 120, 70, 0),
    (gen_random_uuid(), t2, 'Стол 1',      false, true, 2, '{}',           'circle',     80, 80, 0),
    (gen_random_uuid(), t2, 'Стол 2',      false, true, 2, '{}',           'circle',     80, 80, 0),
    (gen_random_uuid(), t2, 'Стол 3',      false, true, 2, '{}',           'circle',     80, 80, 0),
    (gen_random_uuid(), t2, 'Беседка',     false, true, 8, '{"outdoor"}',  'rectangle', 180, 100, 0),
    (gen_random_uuid(), t2, 'Барная стойка', false, true, 4, '{"bar"}',    'rectangle', 200, 60, 0);


  -- ── T2 Table call types ──────────────────────────────────────────────────
  INSERT INTO table_call_types (id, tenant_id, name, sort_order) VALUES
    (gen_random_uuid(), t2, 'Вызвать официанта', 1),
    (gen_random_uuid(), t2, 'Принести счёт',     2),
    (gen_random_uuid(), t2, 'Ещё кальян',        3),
    (gen_random_uuid(), t2, 'Убрать со стола',   4);


  -- ── T2 Reservation settings ──────────────────────────────────────────────
  INSERT INTO reservation_settings (
    id, tenant_id, enabled, slot_step,
    close_buffer_minutes, max_advance_days, min_guests, max_guests, auto_confirm
  ) VALUES (
    gen_random_uuid(), t2, true, 60,
    30, 14, 1, 8, false
  );


  -- ── T2 Gallery ───────────────────────────────────────────────────────────
  INSERT INTO galleries (id, tenant_id, name, title, description, autoplay, autoplay_interval, sort_order)
  VALUES (gen_random_uuid(), t2, 'Атмосфера', 'Наша атмосфера', 'Почувствуй уют ещё до прихода', true, 5, 1);


  -- ============================================================
  -- TENANT 3: Крафт Бар
  -- Craft bar — dine-in + pickup + reservations
  -- ============================================================

  INSERT INTO tenants (
    id, owner_id, name, slug, business_type,
    theme, contacts, working_hours_schedule,
    site_layout, site_content,
    notifications, subscription, modules,
    delivery_min_order, delivery_fee, delivery_description,
    currency, timezone,
    seo, kitchen_config, order_number_config,
    onboarding_completed
  ) VALUES (
    t3, _owner_id,
    'Крафт Бар', 'kraft-bar', 'food',

    -- theme: dark graphite
    '{"preset":"graphite","primaryColor":"#f59e0b","fontFamily":"system","headingFontFamily":"system","palette":null,"buttonRadius":"rounded","cardRadius":12,"cardShadow":"subtle","customThemes":[],"activeCustomId":null}'::jsonb,

    -- contacts
    '{"phoneMode":"shared","phone":"+7 (900) 987-65-43","email":"hello@kraft-bar.demo","address":"пер. Кузнечный, 8, Москва","instagram":"kraft_bar_msk","vk":"kraft_bar","telegram":"kraft_bar_bot","whatsapp":null,"max":null}'::jsonb,

    -- working_hours: Mon-Thu 15-00, Fri-Sun 13-03
    '{"default":{"open":"15:00","close":"00:00"},"days":{"5":{"open":"13:00","close":"03:00"},"6":{"open":"13:00","close":"03:00"},"7":{"open":"13:00","close":"03:00"}}}'::jsonb,

    -- site_layout
    '{"header":{"showNav":true,"navItems":[{"key":"menu","action":"scroll"},{"key":"about","action":"navigate"}],"showPhone":true,"showWorkingHours":true},"sections":{"categoryBar":{"enabled":true,"overflow":"scroll"},"hero":{"enabled":true,"size":"fullscreen","bgType":"gradient","overlayColor":"#1a0a00","overlayOpacity":0.65,"contentPosition":5,"contentAlign":"left","gradientId":"diag-bp"},"banners":{"enabled":true,"displayMode":"auto","autoplay":true,"autoplayInterval":5},"menu":{"enabled":true,"defaultView":"categories","tagDisplayMode":"both"},"gallery":{"enabled":true,"galleryIds":[]},"reviews":{"enabled":false},"delivery":{"enabled":false}},"sectionsOrder":["hero","categoryBar","banners","menu","gallery"],"pages":["about"],"pageSettings":{"menu":{"defaultView":"categories","tagDisplayMode":"both"},"delivery":{"showMap":false,"descriptionMode":"auto"},"gallery":{"galleryIds":[]}}}'::jsonb,

    -- site_content
    '{"logo":null,"hero":{"bgUrl":"https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=1600&q=80","text":"Лучшее крафтовое пиво города. С нами — с характером 🍺"},"about":{"coverUrl":null,"text":"Крафт Бар открылся в 2021 году с одной миссией — показать Москве настоящий крафт. Более 20 сортов разливного пива, редкие импортные бутылки и атмосфера настоящего паба. Приходи с друзьями — мест хватит всем."},"delivery":{"manualText":""}}'::jsonb,

    '{"email":null,"telegramChatId":null}'::jsonb,

    '{"status":"active","plan":"business","trialEndsAt":null,"renewsAt":"2027-01-01T00:00:00Z","pastDueAt":null,"priceOverride":null,"gracePeriodDays":null}'::jsonb,

    -- modules: pickup + dineIn + modifiers + addons + promotions + kitchen + reservations
    '{"delivery":false,"pickup":true,"modifiers":true,"addons":true,"promotions":true,"combos":false,"customRoles":false,"dineIn":true,"kitchen":true,"reservations":true}'::jsonb,

    0, 0, '',
    '₽', 'Europe/Moscow',

    '{"metaTitle":"Крафт Бар — крафтовое пиво в Москве","metaDescription":"Разливное и бутылочное крафтовое пиво, коктейли и отличная еда. Бронируй столик.","ogImage":null,"favicon":null,"robots":"index","googleAnalyticsId":null,"yandexMetrikaId":null}'::jsonb,
    '{"sourceStatusId":null,"completedStatusMap":{"delivery":null,"pickup":null,"dine_in":null}}'::jsonb,
    '{"format":"prefix_counter","scope":"global","prefix":"КБ","dateFormat":"DDMM","resetPeriod":"daily","padLength":3,"startFrom":1}'::jsonb,
    true
  );


  -- ── T3 Order statuses ────────────────────────────────────────────────────
  INSERT INTO order_statuses (id, tenant_id, name, group_type, position) VALUES
    (t3_os_new,       t3, 'Новый заказ', 'new',         1),
    (t3_os_accepted,  t3, 'Принят',      'in_progress', 2),
    (t3_os_cooking,   t3, 'Готовится',   'in_progress', 3),
    (t3_os_ready,     t3, 'Готово',      'completed',   4),
    (t3_os_cancelled, t3, 'Отменён',     'cancelled',   5);


  -- ── T3 Tags ──────────────────────────────────────────────────────────────
  INSERT INTO dish_tags (id, tenant_id, name, icon, color, sort_order) VALUES
    (t3_tag_hit,   t3, 'Хит',     'fire',  'red',    1),
    (t3_tag_new,   t3, 'Новинка', 'star',  'blue',   2),
    (t3_tag_draft, t3, 'Разлив',  'glass', 'amber',  3);


  -- ── T3 Categories ────────────────────────────────────────────────────────
  INSERT INTO categories (id, tenant_id, name, type, sort_order, active) VALUES
    (t3_cat_draft,     t3, 'Разливное',       'regular', 1, true),
    (t3_cat_bottled,   t3, 'Бутылочное',      'regular', 2, true),
    (t3_cat_cocktails, t3, 'Коктейли',        'regular', 3, true),
    (t3_cat_soft,      t3, 'Безалкогольное',  'regular', 4, true),
    (t3_cat_snacks,    t3, 'Закуски',         'regular', 5, true),
    (t3_cat_hot,       t3, 'Горячее',         'regular', 6, true),
    (t3_cat_sets,      t3, 'Сеты',            'regular', 7, true);


  -- ── T3 Modifier groups & options ─────────────────────────────────────────
  INSERT INTO modifier_groups (id, tenant_id, name, sort_order, active) VALUES
    (t3_mg_volume, t3, 'Объём',     1, true),
    (t3_mg_ice,    t3, 'Со льдом',  2, true);

  INSERT INTO modifier_options (id, group_id, name, sort_order, active) VALUES
    (t3_mo_vol_300,  t3_mg_volume, '0.3 л',    1, true),
    (t3_mo_vol_500,  t3_mg_volume, '0.5 л',    2, true),
    (t3_mo_vol_1000, t3_mg_volume, '1 л кувшин', 3, true),
    (t3_mo_no_ice,   t3_mg_ice,    'Без льда', 1, true),
    (t3_mo_with_ice, t3_mg_ice,    'Со льдом', 2, true);


  -- ── T3 Addons ────────────────────────────────────────────────────────────
  INSERT INTO addons (id, tenant_id, name, price, weight, active, sort_order) VALUES
    (t3_addon_chips,   t3, 'Чипсы',         80,  30, true, 1),
    (t3_addon_crouton, t3, 'Сухарики',      60,  25, true, 2),
    (t3_addon_nuts,    t3, 'Орешки',        90,  30, true, 3),
    (t3_addon_jerky,   t3, 'Вяленое мясо', 180,  40, true, 4);

  INSERT INTO addon_presets (id, tenant_id, name, active) VALUES
    (t3_preset_snacks, t3, 'К пиву', true);

  INSERT INTO addon_preset_items (preset_id, addon_id, sort_order) VALUES
    (t3_preset_snacks, t3_addon_chips,   1),
    (t3_preset_snacks, t3_addon_crouton, 2),
    (t3_preset_snacks, t3_addon_nuts,    3),
    (t3_preset_snacks, t3_addon_jerky,   4);


  -- ── T3 Dishes: Draft beer ────────────────────────────────────────────────
  INSERT INTO dishes (id, tenant_id, category_id, name, description, price, photos, active, sort_order,
    ingredients, nutrition) VALUES
    (t3_d_zhig,      t3, t3_cat_draft, 'Жигулёвское',              'Классический советский лагер. Лёгкий, освежающий, узнаваемый',                220, '{}', true, 1, '[]'::jsonb, '{}'::jsonb),
    (t3_d_paulaner,  t3, t3_cat_draft, 'Paulaner Hefeweizen',       'Немецкое нефильтрованное пшеничное пиво. Фруктовое, мягкое, с хлебными нотками', 480, '{}', true, 2, '[]'::jsonb, '{}'::jsonb),
    (t3_d_guinness,  t3, t3_cat_draft, 'Guinness',                  'Ирландский стаут с шелковистой текстурой. Кофе, шоколад, карамель',           520, '{}', true, 3, '[]'::jsonb, '{}'::jsonb),
    (t3_d_ipa,       t3, t3_cat_draft, 'House IPA',                 'Наш фирменный IPA с ярким хмелевым характером. Горькость 65 IBU',             350, '{}', true, 4, '[]'::jsonb, '{}'::jsonb),
    (t3_d_weizen,    t3, t3_cat_draft, 'Пшеничное нефильтрованное', 'Живое мутное пшеничное с банановыми и гвоздичными нотами',                   320, '{}', true, 5, '[]'::jsonb, '{}'::jsonb),
    (t3_d_porter,    t3, t3_cat_draft, 'Портер тёмный',             'Тёмный портер с нотками жжёного солода, шоколада и ванили',                  380, '{}', true, 6, '[]'::jsonb, '{}'::jsonb),
    (t3_d_cider,     t3, t3_cat_draft, 'Сидр яблочный',             'Полусладкий яблочный сидр — лёгкий и освежающий. 5.5%',                      290, '{}', true, 7, '[]'::jsonb, '{}'::jsonb);

  -- Draft beer → volume modifier
  INSERT INTO dish_modifier_groups (dish_id, group_id, sort_order) VALUES
    (t3_d_zhig,     t3_mg_volume, 1),
    (t3_d_paulaner, t3_mg_volume, 1),
    (t3_d_guinness, t3_mg_volume, 1),
    (t3_d_ipa,      t3_mg_volume, 1),
    (t3_d_weizen,   t3_mg_volume, 1),
    (t3_d_porter,   t3_mg_volume, 1),
    (t3_d_cider,    t3_mg_volume, 1);

  INSERT INTO dish_modifier_options (dish_id, option_id, price_delta, is_default, sort_order) VALUES
    (t3_d_zhig,     t3_mo_vol_300,   0,   false, 1),
    (t3_d_zhig,     t3_mo_vol_500,  150,  true,  2),
    (t3_d_zhig,     t3_mo_vol_1000, 350,  false, 3),
    (t3_d_paulaner, t3_mo_vol_300,   0,   false, 1),
    (t3_d_paulaner, t3_mo_vol_500,  150,  true,  2),
    (t3_d_paulaner, t3_mo_vol_1000, 350,  false, 3),
    (t3_d_guinness, t3_mo_vol_300,   0,   false, 1),
    (t3_d_guinness, t3_mo_vol_500,  150,  true,  2),
    (t3_d_guinness, t3_mo_vol_1000, 350,  false, 3),
    (t3_d_ipa,      t3_mo_vol_300,   0,   false, 1),
    (t3_d_ipa,      t3_mo_vol_500,  150,  true,  2),
    (t3_d_ipa,      t3_mo_vol_1000, 350,  false, 3),
    (t3_d_weizen,   t3_mo_vol_300,   0,   false, 1),
    (t3_d_weizen,   t3_mo_vol_500,  150,  true,  2),
    (t3_d_weizen,   t3_mo_vol_1000, 350,  false, 3),
    (t3_d_porter,   t3_mo_vol_300,   0,   false, 1),
    (t3_d_porter,   t3_mo_vol_500,  150,  true,  2),
    (t3_d_porter,   t3_mo_vol_1000, 350,  false, 3),
    (t3_d_cider,    t3_mo_vol_300,   0,   false, 1),
    (t3_d_cider,    t3_mo_vol_500,  150,  true,  2),
    (t3_d_cider,    t3_mo_vol_1000, 350,  false, 3);

  INSERT INTO dish_addons (dish_id, addon_id, sort_order) VALUES
    (t3_d_zhig,     t3_addon_chips,   1),
    (t3_d_zhig,     t3_addon_crouton, 2),
    (t3_d_zhig,     t3_addon_nuts,    3),
    (t3_d_zhig,     t3_addon_jerky,   4),
    (t3_d_paulaner, t3_addon_chips,   1),
    (t3_d_paulaner, t3_addon_crouton, 2),
    (t3_d_paulaner, t3_addon_nuts,    3),
    (t3_d_paulaner, t3_addon_jerky,   4),
    (t3_d_guinness, t3_addon_chips,   1),
    (t3_d_guinness, t3_addon_crouton, 2),
    (t3_d_guinness, t3_addon_nuts,    3),
    (t3_d_guinness, t3_addon_jerky,   4),
    (t3_d_ipa,      t3_addon_chips,   1),
    (t3_d_ipa,      t3_addon_crouton, 2),
    (t3_d_ipa,      t3_addon_nuts,    3),
    (t3_d_ipa,      t3_addon_jerky,   4),
    (t3_d_weizen,   t3_addon_chips,   1),
    (t3_d_weizen,   t3_addon_crouton, 2),
    (t3_d_weizen,   t3_addon_nuts,    3),
    (t3_d_weizen,   t3_addon_jerky,   4),
    (t3_d_porter,   t3_addon_chips,   1),
    (t3_d_porter,   t3_addon_crouton, 2),
    (t3_d_porter,   t3_addon_nuts,    3),
    (t3_d_porter,   t3_addon_jerky,   4),
    (t3_d_cider,    t3_addon_chips,   1),
    (t3_d_cider,    t3_addon_crouton, 2),
    (t3_d_cider,    t3_addon_nuts,    3),
    (t3_d_cider,    t3_addon_jerky,   4);


  -- ── T3 Dishes: Bottled ───────────────────────────────────────────────────
  INSERT INTO dishes (id, tenant_id, category_id, name, description, price, photos, active, sort_order,
    ingredients, nutrition) VALUES
    (t3_d_hoegaarden, t3, t3_cat_bottled, 'Hoegaarden 0.33л',     'Бельгийское белое пиво с кориандром и цедрой апельсина. 4.9%',  380, '{}', true, 1, '[]'::jsonb, '{}'::jsonb),
    (t3_d_chimay,     t3, t3_cat_bottled, 'Chimay Blue 0.33л',    'Аббатское тёмное трапистское пиво. Фрукты, специи, бархат. 9%', 650, '{}', true, 2, '[]'::jsonb, '{}'::jsonb),
    (t3_d_karmeliet,  t3, t3_cat_bottled, 'Karmeliet Triple 0.33л','Бельгийское трипель. Пшеница, овёс, ячмень — три зерна. 8.4%', 720, '{}', true, 3, '[]'::jsonb, '{}'::jsonb),
    (t3_d_duvel,      t3, t3_cat_bottled, 'Duvel 0.33л',           'Легендарный бельгийский золотой эль. Сухой, пряный, 8.5%',    580, '{}', true, 4, '[]'::jsonb, '{}'::jsonb);


  -- ── T3 Dishes: Cocktails ─────────────────────────────────────────────────
  INSERT INTO dishes (id, tenant_id, category_id, name, description, price, photos, active, sort_order,
    ingredients, nutrition) VALUES
    (t3_d_pina,       t3, t3_cat_cocktails, 'Пина Колада',    'Ром, кокосовые сливки, ананасовый сок. Вкус острова',              520, '{}', true, 1, '[{"name":"ром"},{"name":"кокосовые сливки"},{"name":"ананасовый сок"}]'::jsonb, '{}'::jsonb),
    (t3_d_aperol,     t3, t3_cat_cocktails, 'Апероль Шприц', 'Aperol, просекко, газировка и апельсин. Итальянское лето',          480, '{}', true, 2, '[{"name":"Aperol"},{"name":"просекко"},{"name":"газированная вода"},{"name":"апельсин"}]'::jsonb, '{}'::jsonb),
    (t3_d_mojito,     t3, t3_cat_cocktails, 'Мохито',         'Ром, лайм, мята, содовая. Классика которая не надоедает',          490, '{}', true, 3, '[{"name":"ром"},{"name":"лайм"},{"name":"мята"},{"name":"содовая"},{"name":"сахар"}]'::jsonb, '{}'::jsonb),
    (t3_d_negroni,    t3, t3_cat_cocktails, 'Негрони',        'Джин, Кампари, сладкий вермут. Для тех кто знает',                 550, '{}', true, 4, '[{"name":"джин"},{"name":"Кампари"},{"name":"красный вермут"}]'::jsonb, '{}'::jsonb),
    (t3_d_b52,        t3, t3_cat_cocktails, 'Б-52 (шот)',     'Три слоя: Калуа, Бейлис, Куантро. Огненный шот',                  280, '{}', true, 5, '[{"name":"Kahlúa"},{"name":"Baileys"},{"name":"Cointreau"}]'::jsonb, '{}'::jsonb),
    (t3_d_whisky_cola,t3, t3_cat_cocktails, 'Виски-Кола',     'Jack Daniel''s с колой и льдом. Без лишних слов',                   450, '{}', true, 6, '[{"name":"Jack Daniel''s"},{"name":"Coca-Cola"},{"name":"лёд"}]'::jsonb, '{}'::jsonb);

  -- Cocktails → ice modifier
  INSERT INTO dish_modifier_groups (dish_id, group_id, sort_order) VALUES
    (t3_d_pina,        t3_mg_ice, 1),
    (t3_d_aperol,      t3_mg_ice, 1),
    (t3_d_mojito,      t3_mg_ice, 1),
    (t3_d_negroni,     t3_mg_ice, 1),
    (t3_d_whisky_cola, t3_mg_ice, 1);

  INSERT INTO dish_modifier_options (dish_id, option_id, price_delta, is_default, sort_order) VALUES
    (t3_d_pina,        t3_mo_no_ice,   0, false, 1),
    (t3_d_pina,        t3_mo_with_ice, 0, true,  2),
    (t3_d_aperol,      t3_mo_no_ice,   0, false, 1),
    (t3_d_aperol,      t3_mo_with_ice, 0, true,  2),
    (t3_d_mojito,      t3_mo_no_ice,   0, false, 1),
    (t3_d_mojito,      t3_mo_with_ice, 0, true,  2),
    (t3_d_negroni,     t3_mo_no_ice,   0, false, 1),
    (t3_d_negroni,     t3_mo_with_ice, 0, true,  2),
    (t3_d_whisky_cola, t3_mo_no_ice,   0, false, 1),
    (t3_d_whisky_cola, t3_mo_with_ice, 0, true,  2);


  -- ── T3 Dishes: Soft drinks ───────────────────────────────────────────────
  INSERT INTO dishes (id, tenant_id, category_id, name, description, price, photos, active, sort_order,
    ingredients, nutrition) VALUES
    (t3_d_cola2,   t3, t3_cat_soft, 'Coca-Cola',        'Охлаждённая кола с льдом',   180, '{}', true, 1, '[]'::jsonb, '{}'::jsonb),
    (t3_d_juice2,  t3, t3_cat_soft, 'Сок',              'Апельсин, яблоко, томат',    160, '{}', true, 2, '[]'::jsonb, '{}'::jsonb),
    (t3_d_water2,  t3, t3_cat_soft, 'Вода',             'Газированная / негазированная', 120, '{}', true, 3, '[]'::jsonb, '{}'::jsonb),
    (t3_d_mors2,   t3, t3_cat_soft, 'Морс домашний',    'Клюква, малина или смородина', 220, '{}', true, 4, '[]'::jsonb, '{}'::jsonb);


  -- ── T3 Dishes: Snacks ────────────────────────────────────────────────────
  INSERT INTO dishes (id, tenant_id, category_id, name, description, price, photos, active, sort_order,
    ingredients, nutrition) VALUES
    (t3_d_fries,       t3, t3_cat_snacks, 'Картофель фри',    'Хрустящий фри с соусом на выбор. 250г',                  280, '{}', true, 1, '[{"name":"картофель"},{"name":"соль"},{"name":"соус"}]'::jsonb, '{"calories":380,"protein":5,"fat":14,"carbs":58,"weight":280}'::jsonb),
    (t3_d_onion_rings, t3, t3_cat_snacks, 'Луковые кольца',   'Хрустящие кольца в пивном кляре с соусом ранч',          320, '{}', true, 2, '[{"name":"лук"},{"name":"пивной кляр"},{"name":"соус ранч"}]'::jsonb, '{"calories":420,"protein":7,"fat":18,"carbs":54,"weight":250}'::jsonb),
    (t3_d_nuggets2,    t3, t3_cat_snacks, 'Наггетсы',         '10 куриных наггетсов с BBQ и чесночным соусом',          380, '{}', true, 3, '[{"name":"куриное филе"},{"name":"панировка"},{"name":"BBQ соус"}]'::jsonb, '{"calories":440,"protein":26,"fat":20,"carbs":42,"weight":280}'::jsonb),
    (t3_d_cheese_pl,   t3, t3_cat_snacks, 'Сырная тарелка',   'Гауда, бри, горгонзола, пармезан с мёдом и виноградом',  680, '{}', true, 4, '[{"name":"гауда"},{"name":"бри"},{"name":"горгонзола"},{"name":"пармезан"},{"name":"мёд"},{"name":"виноград"}]'::jsonb, '{}'::jsonb),
    (t3_d_meat_pl,     t3, t3_cat_snacks, 'Мясная тарелка',   'Хамон, салями, прошутто с горчицей и огурчиками',        780, '{}', true, 5, '[{"name":"хамон"},{"name":"салями"},{"name":"прошутто"},{"name":"горчица"},{"name":"корнишоны"}]'::jsonb, '{}'::jsonb),
    (t3_d_brusc,       t3, t3_cat_snacks, 'Брускетты (4 шт)', 'Три вкуса: помидор+базилик, авокадо, лосось+крем-сыр',   450, '{}', true, 6, '[{"name":"багет"},{"name":"помидоры"},{"name":"авокадо"},{"name":"лосось"}]'::jsonb, '{}'::jsonb);


  -- ── T3 Dishes: Hot ───────────────────────────────────────────────────────
  INSERT INTO dishes (id, tenant_id, category_id, name, description, price, photos, active, sort_order,
    ingredients, nutrition) VALUES
    (t3_d_bar_burger, t3, t3_cat_hot, 'Барный Бургер',    'Двойная говяжья котлета, бекон, чеддер, карамелизованный лук и фирменный соус', 580, '{}', true, 1, '[{"name":"говяжья котлета"},{"name":"бекон"},{"name":"чеддер"},{"name":"карамелизованный лук"}]'::jsonb, '{"calories":720,"protein":42,"fat":36,"carbs":52,"weight":380}'::jsonb),
    (t3_d_steak,      t3, t3_cat_hot, 'Стейк рибай 250г', 'Рибай Medium прожарки, картофель печёный, соус из красного вина',              1200, '{}', true, 2, '[{"name":"рибай"},{"name":"картофель"},{"name":"соус из красного вина"},{"name":"розмарин"}]'::jsonb, '{"calories":680,"protein":52,"fat":38,"carbs":24,"weight":380}'::jsonb),
    (t3_d_ribs,       t3, t3_cat_hot, 'Рёбрышки BBQ',     'Свиные рёбрышки в фирменном BBQ маринаде, картошка фри и коул слоу',           950, '{}', true, 3, '[{"name":"свиные рёбрышки"},{"name":"BBQ соус"},{"name":"картофель фри"},{"name":"коул слоу"}]'::jsonb, '{"calories":860,"protein":48,"fat":44,"carbs":56,"weight":500}'::jsonb);


  -- ── T3 Dishes: Sets ──────────────────────────────────────────────────────
  INSERT INTO dishes (id, tenant_id, category_id, name, description, price, photos, active, sort_order,
    ingredients, nutrition) VALUES
    (t3_d_set_friday,  t3, t3_cat_sets, 'Сет "Пятница"',
      'Хаус IPA × 2 + сырная тарелка + картошка фри — идеально для двоих',
      1800, '{}', true, 1, '[]'::jsonb, '{}'::jsonb),
    (t3_d_set_evening, t3, t3_cat_sets, 'Сет "Вечер"',
      '4 сорта пива по 0.3л на выбор + ассорти снеков — крафтовый тур по стилям',
      2400, '{}', true, 2, '[]'::jsonb, '{}'::jsonb);


  -- ── T3 Tag assignments ───────────────────────────────────────────────────
  INSERT INTO dish_tag_assignments (dish_id, tag_id, tenant_id, sort_order) VALUES
    (t3_d_ipa,        t3_tag_hit,   t3, 1),
    (t3_d_ipa,        t3_tag_draft, t3, 2),
    (t3_d_guinness,   t3_tag_hit,   t3, 1),
    (t3_d_guinness,   t3_tag_draft, t3, 2),
    (t3_d_paulaner,   t3_tag_draft, t3, 1),
    (t3_d_chimay,     t3_tag_hit,   t3, 1),
    (t3_d_chimay,     t3_tag_new,   t3, 2),
    (t3_d_karmeliet,  t3_tag_new,   t3, 1),
    (t3_d_negroni,    t3_tag_hit,   t3, 1),
    (t3_d_set_friday, t3_tag_hit,   t3, 1),
    (t3_d_steak,      t3_tag_new,   t3, 1);


  -- ── T3 Tables ────────────────────────────────────────────────────────────
  INSERT INTO tables (id, tenant_id, name, is_open, is_active, capacity, tags, shape, table_width, table_height, rotation) VALUES
    (gen_random_uuid(), t3, 'Стол 1',      false, true, 2, '{}',       'circle',    80, 80, 0),
    (gen_random_uuid(), t3, 'Стол 2',      false, true, 2, '{}',       'circle',    80, 80, 0),
    (gen_random_uuid(), t3, 'Стол 3',      false, true, 4, '{}',       'rectangle', 120, 80, 0),
    (gen_random_uuid(), t3, 'Стол 4',      false, true, 4, '{}',       'rectangle', 120, 80, 0),
    (gen_random_uuid(), t3, 'Стол 5',      false, true, 4, '{}',       'rectangle', 120, 80, 0),
    (gen_random_uuid(), t3, 'Стол 6',      false, true, 6, '{"big"}',  'rectangle', 160, 90, 0),
    (gen_random_uuid(), t3, 'Стол 7',      false, true, 6, '{"big"}',  'rectangle', 160, 90, 0),
    (gen_random_uuid(), t3, 'Высокий 1',   false, true, 2, '{"high"}', 'circle',    70, 70, 0),
    (gen_random_uuid(), t3, 'Высокий 2',   false, true, 2, '{"high"}', 'circle',    70, 70, 0),
    (gen_random_uuid(), t3, 'Высокий 3',   false, true, 2, '{"high"}', 'circle',    70, 70, 0),
    (gen_random_uuid(), t3, 'Барная стойка 1', false, true, 1, '{"bar"}', 'rectangle', 80, 50, 0),
    (gen_random_uuid(), t3, 'Барная стойка 2', false, true, 1, '{"bar"}', 'rectangle', 80, 50, 0);


  -- ── T3 Table call types ──────────────────────────────────────────────────
  INSERT INTO table_call_types (id, tenant_id, name, sort_order) VALUES
    (gen_random_uuid(), t3, 'Вызвать официанта',  1),
    (gen_random_uuid(), t3, 'Принести счёт',      2),
    (gen_random_uuid(), t3, 'Ещё пиво',           3),
    (gen_random_uuid(), t3, 'Убрать посуду',      4);


  -- ── T3 Reservation settings ──────────────────────────────────────────────
  INSERT INTO reservation_settings (
    id, tenant_id, enabled, slot_step,
    close_buffer_minutes, max_advance_days, min_guests, max_guests, auto_confirm
  ) VALUES (
    gen_random_uuid(), t3, true, 30,
    30, 30, 1, 10, true
  );


  -- ── T3 Promotions ────────────────────────────────────────────────────────
  INSERT INTO promotions (id, tenant_id, title, description, type, discount_type,
    discount_value, branch_ids, conditions, active) VALUES
    (gen_random_uuid(), t3,
      'Счастливый час',
      'С 15:00 до 18:00 пиво дешевле на 20%',
      'happy_hour', 'percent', 20, '{}',
      '{"timeFrom":"15:00","timeTo":"18:00"}'::jsonb, true);


  -- ── T3 Gallery ───────────────────────────────────────────────────────────
  INSERT INTO galleries (id, tenant_id, name, title, description, autoplay, autoplay_interval, sort_order)
  VALUES (gen_random_uuid(), t3, 'Интерьер', 'Наш бар', 'Место где хочется задержаться', true, 4, 1);


  -- ============================================================
  -- PHOTOS
  -- ============================================================

  -- ── Большая Ложка: Rolls ─────────────────────────────────────────────────
  UPDATE dishes SET photos = ARRAY['https://images.unsplash.com/photo-1617196034183-421b4040ed20?auto=format&fit=crop&w=800&q=80']
    WHERE id IN (t1_d_philly, t1_d_california, t1_d_dragon, t1_d_yasai, t1_d_spicy_tuna);

  -- ── Большая Ложка: Pizza ─────────────────────────────────────────────────
  UPDATE dishes SET photos = ARRAY['https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80']
    WHERE id = t1_d_margherita;
  UPDATE dishes SET photos = ARRAY['https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=800&q=80']
    WHERE id IN (t1_d_pepperoni, t1_d_four_cheese, t1_d_hawaiian, t1_d_bbq_chicken);

  -- ── Большая Ложка: Burgers ───────────────────────────────────────────────
  UPDATE dishes SET photos = ARRAY['https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80']
    WHERE id IN (t1_d_classic, t1_d_cheese_brg, t1_d_bbq_brg, t1_d_vegan_brg, t1_d_chicken_brg);

  -- ── Большая Ложка: Salads ────────────────────────────────────────────────
  UPDATE dishes SET photos = ARRAY['https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80']
    WHERE id IN (t1_d_caesar, t1_d_greek, t1_d_nicoise);

  -- ── Большая Ложка: Hot ───────────────────────────────────────────────────
  UPDATE dishes SET photos = ARRAY['https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=800&q=80']
    WHERE id IN (t1_d_carbonara, t1_d_bolognese);
  UPDATE dishes SET photos = ARRAY['https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80']
    WHERE id = t1_d_salmon;
  UPDATE dishes SET photos = ARRAY['https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80']
    WHERE id = t1_d_nuggets;

  -- ── Большая Ложка: Drinks ────────────────────────────────────────────────
  UPDATE dishes SET photos = ARRAY['https://images.unsplash.com/photo-1551538827-9c037cb4f32a?auto=format&fit=crop&w=800&q=80']
    WHERE id IN (t1_d_lemonade, t1_d_cola, t1_d_juice);

  -- ── Большая Ложка: Desserts ──────────────────────────────────────────────
  UPDATE dishes SET photos = ARRAY['https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=800&q=80']
    WHERE id = t1_d_tiramisu;
  UPDATE dishes SET photos = ARRAY['https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=800&q=80']
    WHERE id IN (t1_d_cheesecake, t1_d_fondant, t1_d_panna_cotta);

  -- ── Дымовая: Hookahs ─────────────────────────────────────────────────────
  UPDATE dishes SET photos = ARRAY['https://images.unsplash.com/photo-1543253687-c931c8e01820?auto=format&fit=crop&w=800&q=80']
    WHERE id IN (t2_d_two_apples, t2_d_mango_pass, t2_d_blueberry, t2_d_mint_lemon);
  UPDATE dishes SET photos = ARRAY['https://images.unsplash.com/photo-1585507252242-11fe632c26e8?auto=format&fit=crop&w=800&q=80']
    WHERE id IN (t2_d_watermelon, t2_d_cola_ice, t2_d_peach_rasp);

  -- ── Дымовая: Tea & Drinks ────────────────────────────────────────────────
  UPDATE dishes SET photos = ARRAY['https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=800&q=80']
    WHERE id IN (t2_d_chinese_tea, t2_d_mango_smth, t2_d_lemonade2, t2_d_mors, t2_d_cocoa);

  -- ── Дымовая: Snacks ──────────────────────────────────────────────────────
  UPDATE dishes SET photos = ARRAY['https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=800&q=80']
    WHERE id IN (t2_d_cheese_plat, t2_d_nuts, t2_d_nachos);
  UPDATE dishes SET photos = ARRAY['https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80']
    WHERE id IN (t2_d_meat_plat, t2_d_bruschetta);

  -- ── Дымовая: Desserts ────────────────────────────────────────────────────
  UPDATE dishes SET photos = ARRAY['https://images.unsplash.com/photo-1562376552-0d160a2f238d?auto=format&fit=crop&w=800&q=80']
    WHERE id IN (t2_d_medovik, t2_d_truffles, t2_d_waffles);

  -- ── Крафт Бар: Draft beer ────────────────────────────────────────────────
  UPDATE dishes SET photos = ARRAY['https://images.unsplash.com/photo-1436076863939-06870fe779c2?auto=format&fit=crop&w=800&q=80']
    WHERE id IN (t3_d_zhig, t3_d_ipa, t3_d_weizen, t3_d_porter);
  UPDATE dishes SET photos = ARRAY['https://images.unsplash.com/photo-1510972527921-ce03766a1cf1?auto=format&fit=crop&w=800&q=80']
    WHERE id = t3_d_guinness;
  UPDATE dishes SET photos = ARRAY['https://images.unsplash.com/photo-1535958636474-b021ee887b13?auto=format&fit=crop&w=800&q=80']
    WHERE id IN (t3_d_paulaner, t3_d_cider);

  -- ── Крафт Бар: Bottled beer ──────────────────────────────────────────────
  UPDATE dishes SET photos = ARRAY['https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?auto=format&fit=crop&w=800&q=80']
    WHERE id IN (t3_d_hoegaarden, t3_d_chimay, t3_d_karmeliet, t3_d_duvel);

  -- ── Крафт Бар: Cocktails ─────────────────────────────────────────────────
  UPDATE dishes SET photos = ARRAY['https://images.unsplash.com/photo-1571950006418-f99e0b9aebde?auto=format&fit=crop&w=800&q=80']
    WHERE id = t3_d_aperol;
  UPDATE dishes SET photos = ARRAY['https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=800&q=80']
    WHERE id IN (t3_d_mojito, t3_d_pina, t3_d_negroni, t3_d_b52, t3_d_whisky_cola);

  -- ── Крафт Бар: Soft ──────────────────────────────────────────────────────
  UPDATE dishes SET photos = ARRAY['https://images.unsplash.com/photo-1551538827-9c037cb4f32a?auto=format&fit=crop&w=800&q=80']
    WHERE id IN (t3_d_cola2, t3_d_juice2, t3_d_water2, t3_d_mors2);

  -- ── Крафт Бар: Snacks ────────────────────────────────────────────────────
  UPDATE dishes SET photos = ARRAY['https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=800&q=80']
    WHERE id = t3_d_fries;
  UPDATE dishes SET photos = ARRAY['https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=800&q=80']
    WHERE id IN (t3_d_onion_rings, t3_d_nuggets2, t3_d_cheese_pl, t3_d_brusc);
  UPDATE dishes SET photos = ARRAY['https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80']
    WHERE id = t3_d_meat_pl;

  -- ── Крафт Бар: Hot ───────────────────────────────────────────────────────
  UPDATE dishes SET photos = ARRAY['https://images.unsplash.com/photo-1553979459-d2229ba7433b?auto=format&fit=crop&w=800&q=80']
    WHERE id = t3_d_bar_burger;
  UPDATE dishes SET photos = ARRAY['https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=800&q=80']
    WHERE id = t3_d_steak;
  UPDATE dishes SET photos = ARRAY['https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80']
    WHERE id = t3_d_ribs;

  -- ── Крафт Бар: Sets ──────────────────────────────────────────────────────
  UPDATE dishes SET photos = ARRAY['https://images.unsplash.com/photo-1436076863939-06870fe779c2?auto=format&fit=crop&w=800&q=80']
    WHERE id IN (t3_d_set_friday, t3_d_set_evening);


  RAISE NOTICE '✅ Demo tenants created successfully!';
  RAISE NOTICE '  🥄 Большая Ложка  → slug: bolshaya-lozhka';
  RAISE NOTICE '  💨 Дымовая        → slug: dymovaya';
  RAISE NOTICE '  🍺 Крафт Бар      → slug: kraft-bar';

END $$;
