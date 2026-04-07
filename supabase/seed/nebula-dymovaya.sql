-- =============================================================================
-- Заливка меню NEBULA в существующий тенант "Дымовая"
-- =============================================================================
-- Запускать через Supabase SQL Editor (service role)
-- =============================================================================

DO $$
DECLARE
  -- Используем существующий тенант "Дымовая"
  t uuid := '3a18692d-cb7c-4e6b-9e8e-f0e30119dadd';

  -- Categories
  cat_hookahs       uuid := gen_random_uuid();
  cat_wines         uuid := gen_random_uuid();
  cat_author_cock   uuid := gen_random_uuid();
  cat_spring        uuid := gen_random_uuid();
  cat_classic_cock  uuid := gen_random_uuid();
  cat_spirits       uuid := gen_random_uuid();
  cat_beer          uuid := gen_random_uuid();
  cat_mocktails     uuid := gen_random_uuid();
  cat_lemonades     uuid := gen_random_uuid();
  cat_coffee        uuid := gen_random_uuid();
  cat_drinks        uuid := gen_random_uuid();
  cat_author_tea    uuid := gen_random_uuid();
  cat_classic_tea   uuid := gen_random_uuid();
  cat_chinese_tea   uuid := gen_random_uuid();
  cat_snacks        uuid := gen_random_uuid();
  cat_desserts      uuid := gen_random_uuid();

  -- Modifier groups
  mg_wine_vol       uuid := gen_random_uuid();
  mg_spirit_vol     uuid := gen_random_uuid();
  mg_lemonade_vol   uuid := gen_random_uuid();
  mg_tincture_vol   uuid := gen_random_uuid();

  -- Modifier options
  mo_wine_glass     uuid := gen_random_uuid();
  mo_wine_bottle    uuid := gen_random_uuid();
  mo_spirit_shot    uuid := gen_random_uuid();
  mo_spirit_bottle  uuid := gen_random_uuid();
  mo_lemon_small    uuid := gen_random_uuid();
  mo_lemon_big      uuid := gen_random_uuid();
  mo_tinct_shot     uuid := gen_random_uuid();
  mo_tinct_500      uuid := gen_random_uuid();

  -- ── Wines (need modifier linkage) ──────────────────────────────────────────
  d_wine_cielo      uuid := gen_random_uuid();
  d_wine_uby        uuid := gen_random_uuid();
  d_wine_esse       uuid := gen_random_uuid();
  d_wine_nobilomo_r uuid := gen_random_uuid();
  d_wine_undurraga  uuid := gen_random_uuid();
  d_wine_askaneli   uuid := gen_random_uuid();
  d_wine_nobilomo_w uuid := gen_random_uuid();
  d_wine_weinkeller uuid := gen_random_uuid();
  d_wine_airen      uuid := gen_random_uuid();
  d_wine_reinhard   uuid := gen_random_uuid();
  d_wine_contrasena uuid := gen_random_uuid();
  d_wine_jpchanet   uuid := gen_random_uuid();

  -- ── Spirits (need modifier linkage) ────────────────────────────────────────
  d_onegin_1   uuid := gen_random_uuid();
  d_onegin_2   uuid := gen_random_uuid();
  d_onegin_3   uuid := gen_random_uuid();
  d_onegin_4   uuid := gen_random_uuid();
  d_onegin_5   uuid := gen_random_uuid();
  d_campari    uuid := gen_random_uuid();
  d_aperol     uuid := gen_random_uuid();
  d_cinzano    uuid := gen_random_uuid();
  d_jager      uuid := gen_random_uuid();
  d_coffee_liq uuid := gen_random_uuid();
  d_torres     uuid := gen_random_uuid();
  d_jim_beam   uuid := gen_random_uuid();
  d_ballantines uuid := gen_random_uuid();
  d_jameson    uuid := gen_random_uuid();
  d_montifaud  uuid := gen_random_uuid();
  d_barrister  uuid := gen_random_uuid();
  d_brecon     uuid := gen_random_uuid();
  d_135east    uuid := gen_random_uuid();
  d_barcelo    uuid := gen_random_uuid();
  d_contrabando uuid := gen_random_uuid();
  d_pere_magloire uuid := gen_random_uuid();
  d_espolon    uuid := gen_random_uuid();
  d_onza       uuid := gen_random_uuid();

  -- ── Lemonades (need modifier linkage) ──────────────────────────────────────
  d_lemon_1 uuid := gen_random_uuid();
  d_lemon_2 uuid := gen_random_uuid();
  d_lemon_3 uuid := gen_random_uuid();
  d_lemon_4 uuid := gen_random_uuid();
  d_lemon_5 uuid := gen_random_uuid();
  d_lemon_6 uuid := gen_random_uuid();
  d_lemon_7 uuid := gen_random_uuid();
  d_lemon_8 uuid := gen_random_uuid();

BEGIN

  -- ============================================================
  -- Удаляем старое меню Дымовой (каскад через FK)
  -- ============================================================
  DELETE FROM dish_modifier_options WHERE dish_id IN (SELECT id FROM dishes WHERE tenant_id = t);
  DELETE FROM dish_modifier_groups WHERE dish_id IN (SELECT id FROM dishes WHERE tenant_id = t);
  DELETE FROM dishes WHERE tenant_id = t;
  DELETE FROM modifier_options WHERE group_id IN (SELECT id FROM modifier_groups WHERE tenant_id = t);
  DELETE FROM modifier_groups WHERE tenant_id = t;
  DELETE FROM categories WHERE tenant_id = t;


  -- ── Categories ─────────────────────────────────────────────────────────────
  INSERT INTO categories (id, tenant_id, name, type, sort_order, active) VALUES
    (cat_hookahs,       t, 'Кальяны',              'regular',  1, true),
    (cat_wines,         t, 'Вина',                  'regular',  2, true),
    (cat_author_cock,   t, 'Авторские коктейли',    'regular',  3, true),
    (cat_spring,        t, 'Весенний Special',       'regular',  4, true),
    (cat_classic_cock,  t, 'Классические коктейли', 'regular',  5, true),
    (cat_spirits,       t, 'Крепкий алкоголь',      'regular',  6, true),
    (cat_beer,          t, 'Пиво',                  'regular',  7, true),
    (cat_mocktails,     t, 'Mocktails',             'regular',  8, true),
    (cat_lemonades,     t, 'Авторские лимонады',    'regular',  9, true),
    (cat_coffee,        t, 'Кофе и какао',          'regular', 10, true),
    (cat_drinks,        t, 'Напитки',               'regular', 11, true),
    (cat_author_tea,    t, 'Авторский чай',         'regular', 12, true),
    (cat_classic_tea,   t, 'Классический чай',      'regular', 13, true),
    (cat_chinese_tea,   t, 'Китайский чай',         'regular', 14, true),
    (cat_snacks,        t, 'Закуски',               'regular', 15, true),
    (cat_desserts,      t, 'Десерты',               'regular', 16, true);


  -- ── Modifier groups & options ──────────────────────────────────────────────
  INSERT INTO modifier_groups (id, tenant_id, name, sort_order, active) VALUES
    (mg_wine_vol,     t, 'Объём', 1, true),
    (mg_spirit_vol,   t, 'Объём', 2, true),
    (mg_lemonade_vol, t, 'Объём', 3, true),
    (mg_tincture_vol, t, 'Объём', 4, true);

  INSERT INTO modifier_options (id, group_id, name, sort_order, active) VALUES
    (mo_wine_glass,    mg_wine_vol,     'Бокал 125 мл',   1, true),
    (mo_wine_bottle,   mg_wine_vol,     'Бутылка 750 мл', 2, true),
    (mo_spirit_shot,   mg_spirit_vol,   '50 мл',          1, true),
    (mo_spirit_bottle, mg_spirit_vol,   'Бутылка',        2, true),
    (mo_lemon_small,   mg_lemonade_vol, '450 мл',         1, true),
    (mo_lemon_big,     mg_lemonade_vol, '1500 мл',        2, true),
    (mo_tinct_shot,    mg_tincture_vol, '50 мл',          1, true),
    (mo_tinct_500,     mg_tincture_vol, '500 мл',         2, true);


  -- ════════════════════════════════════════════════════════════════════════════
  -- DISHES
  -- ════════════════════════════════════════════════════════════════════════════

  -- ── 1. Кальяны ─────────────────────────────────────────────────────────────
  INSERT INTO dishes (id, tenant_id, category_id, name, description, price, photos, active, sort_order,
    ingredients, nutrition, weight_unit, requires_kitchen) VALUES
    (gen_random_uuid(), t, cat_hookahs, 'Classic (1-3 гостя)',  'Классический кальян на компанию до 3 человек',   1400, '{}', true, 1, '[]'::jsonb, '{}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_hookahs, 'Classic (4-6 гостей)', 'Классический кальян на компанию до 6 человек',   2500, '{}', true, 2, '[]'::jsonb, '{}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_hookahs, 'Special (1 кальян)',   'Специальный микс от кальянного мастера',          1000, '{}', true, 3, '[]'::jsonb, '{}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_hookahs, 'Special (2 кальяна)',  'Два специальных кальяна',                         2200, '{}', true, 4, '[]'::jsonb, '{}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_hookahs, 'Бизнес Гранат',       'Бизнес-кальян 13:00-16:00, гранат',               2200, '{}', true, 5, '[]'::jsonb, '{}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_hookahs, 'Бизнес Ананас',       'Бизнес-кальян 13:00-16:00, ананас',               2000, '{}', true, 6, '[]'::jsonb, '{}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_hookahs, 'Бизнес Грейпфрут',    'Бизнес-кальян 13:00-16:00, грейпфрут',            2000, '{}', true, 7, '[]'::jsonb, '{}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_hookahs, 'Parfume Deus',        'Бизнес-кальян 13:00-16:00, парфюм',               2000, '{}', true, 8, '[]'::jsonb, '{}'::jsonb, 'мл', false);


  -- ── 2. Вина ────────────────────────────────────────────────────────────────

  -- Wines WITH glass/bottle modifier
  INSERT INTO dishes (id, tenant_id, category_id, name, description, price, photos, active, sort_order,
    ingredients, nutrition, weight_unit, requires_kitchen) VALUES
    -- Розовое
    (d_wine_cielo,      t, cat_wines, 'Cielo Pinot Grigio Blush',    'Италия, розовое полусухое',      450, '{}', true,  1, '[]'::jsonb, '{"weight":125}'::jsonb, 'мл', false),
    (d_wine_uby,        t, cat_wines, 'Uby №6',                      'Франция, IGP',                   600, '{}', true,  2, '[]'::jsonb, '{"weight":125}'::jsonb, 'мл', false),
    -- Красное
    (d_wine_esse,       t, cat_wines, 'Esse Unplugged Saperavi',     'Крым, красное сухое',            670, '{}', true,  3, '[]'::jsonb, '{"weight":125}'::jsonb, 'мл', false),
    (d_wine_nobilomo_r, t, cat_wines, 'Nobilomo Marzemino',          'Италия, красное полусладкое',    590, '{}', true,  4, '[]'::jsonb, '{"weight":125}'::jsonb, 'мл', false),
    (d_wine_undurraga,  t, cat_wines, 'Undurraga Santiago',           'Чили, красное полусладкое',      450, '{}', true,  5, '[]'::jsonb, '{"weight":125}'::jsonb, 'мл', false);

  -- Игристое (bottle only — NO modifier)
  INSERT INTO dishes (id, tenant_id, category_id, name, description, price, photos, active, sort_order,
    ingredients, nutrition, weight_unit, requires_kitchen) VALUES
    (gen_random_uuid(), t, cat_wines, 'Nuviana Dulce Cava',                  'Испания, белое полусладкое', 3000, '{}', true,  6, '[]'::jsonb, '{"weight":750}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_wines, 'Cavatina Ribolla Gialla Spumante',    'Италия, белое сухое',        3500, '{}', true,  7, '[]'::jsonb, '{"weight":750}'::jsonb, 'мл', false);

  -- Белое (with modifier)
  INSERT INTO dishes (id, tenant_id, category_id, name, description, price, photos, active, sort_order,
    ingredients, nutrition, weight_unit, requires_kitchen) VALUES
    (d_wine_askaneli,   t, cat_wines, 'Askaneli Brothers Tsinandali',       'Грузия, белое сухое',        450, '{}', true,  8, '[]'::jsonb, '{"weight":125}'::jsonb, 'мл', false),
    (d_wine_nobilomo_w, t, cat_wines, 'Nobilomo Spergola',                  'Италия, белое полусладкое',  590, '{}', true,  9, '[]'::jsonb, '{"weight":125}'::jsonb, 'мл', false),
    (d_wine_weinkeller, t, cat_wines, 'Weinkellerstolz Grüner Veltliner',  'Австрия',                    590, '{}', true, 10, '[]'::jsonb, '{"weight":125}'::jsonb, 'мл', false);

  -- Безалкогольное (with modifier)
  INSERT INTO dishes (id, tenant_id, category_id, name, description, price, photos, active, sort_order,
    ingredients, nutrition, weight_unit, requires_kitchen) VALUES
    (d_wine_airen,      t, cat_wines, 'Airen Sparkling',                     'Испания, игристое белое',           500, '{}', true, 11, '[]'::jsonb, '{"weight":125}'::jsonb, 'мл', false),
    (d_wine_reinhard,   t, cat_wines, 'Reinhard Green Label Riesling',       'Германия, белое полусладкое',       560, '{}', true, 12, '[]'::jsonb, '{"weight":125}'::jsonb, 'мл', false),
    (d_wine_contrasena, t, cat_wines, 'Contraseña Monastrell',               'Испания, красное полусухое',        560, '{}', true, 13, '[]'::jsonb, '{"weight":125}'::jsonb, 'мл', false),
    (d_wine_jpchanet,   t, cat_wines, 'JP.Chanet',                           'Франция, белое сладкое',            500, '{}', true, 14, '[]'::jsonb, '{"weight":125}'::jsonb, 'мл', false);


  -- ── 3. Авторские коктейли ──────────────────────────────────────────────────
  INSERT INTO dishes (id, tenant_id, category_id, name, description, long_description, price, photos, active, sort_order,
    ingredients, nutrition, weight_unit, requires_kitchen) VALUES
    (gen_random_uuid(), t, cat_author_cock, 'Nebula',
      'Мягкий, с цветочным шлейфом',
      'Характер Небулы непокорный и агрессивный, она мстительна и жестока. Всё это описание сногсшибательной злодейки из Marvel. Наша же, напротив, мягка, с цветочным шлейфом.',
      600, '{}', true, 1, '[]'::jsonb, '{"weight":450}'::jsonb, 'мл', false),

    (gen_random_uuid(), t, cat_author_cock, 'Моана',
      'Тропическая феерия с листьями пандана и ромом',
      'Тропическая феерия вкусов, способная перенести вас прямиком на живописные пляжи. Свежие листья пандана, сладость банана, изящная горчинка вермута и пряность рома.',
      450, '{}', true, 2, '[]'::jsonb, '{"weight":120}'::jsonb, 'мл', false),

    (gen_random_uuid(), t, cat_author_cock, 'Адонис 2.0',
      'Херес, миндальная горчинка, маракуйя',
      'Твист на коктейль, созданный в честь мюзикла в 1884 году. Терпкость хереса, горчинка миндальной косточки и обволакивающий вкус сладкой маракуйи.',
      450, '{}', true, 3, '[]'::jsonb, '{"weight":300}'::jsonb, 'мл', false),

    (gen_random_uuid(), t, cat_author_cock, 'Маракуйя Дайкири',
      'Дайкири с маракуйей и игристым',
      'А что если классический Дайкири сделать на соусе из маракуйи и добавить игристое? Получится освежающий, слегка кисловатый с фруктовым послевкусием коктейль.',
      650, '{}', true, 4, '[]'::jsonb, '{"weight":250}'::jsonb, 'мл', false),

    (gen_random_uuid(), t, cat_author_cock, 'Гринч',
      'Можжевельник, фейхоа, еловые иголки, абсент',
      'Это суета, коварность и безрассудство, в которых сухость можжевеловых ноток отлично сочетается со сладостью фейхоа. Колкость еловых иголок и жгучесть абсента.',
      450, '{}', true, 5, '[]'::jsonb, '{"weight":300}'::jsonb, 'мл', false),

    (gen_random_uuid(), t, cat_author_cock, 'Камасутра',
      'Ром, базилик, сливочно-банановый крем с грушей',
      'Коктейль, задействующий все вкусовые рецепторы. Пряный ром, лёгкая горчинка базилика и обволакивающая сладость сливочно-бананового крема с грушей.',
      450, '{}', true, 6, '[]'::jsonb, '{"weight":120}'::jsonb, 'мл', false),

    (gen_random_uuid(), t, cat_author_cock, 'Лимончелло шприц',
      'Лимончелло, маракуйя, брют, содовая',
      'Как летний ливень из Италии: кислый удар лимончелло, сладкие брызги маракуйи и пузырьки брюта, разбавленные содовой прохладой.',
      700, '{}', true, 7, '[]'::jsonb, '{"weight":450}'::jsonb, 'мл', false),

    (gen_random_uuid(), t, cat_author_cock, 'Twin Peaks',
      'Эспрессо, вишня, водка, кофейный ликёр',
      'Бархатистая гроза вкусов, где ледяная острота эспрессо сталкивается с томной сладостью спелой вишни. Водка, словно молния, прорезает насыщенность, оставляя за собой тёплый шлейф кофейного ликёра. Мгновение — и вы чувствуете, как тает во рту нежнейшая текстура «мороженого».',
      650, '{}', true, 8, '[]'::jsonb, '{"weight":250}'::jsonb, 'мл', false),

    (gen_random_uuid(), t, cat_author_cock, 'Кармелита',
      'Джин, вино, васильковый кордиал',
      'Коктейль-загадка, где джин встречается с бархатной терпкостью вина, васильковый кордиал окутывает томной восточной сладостью. Напиток, который играет на контрастах — будто страстное танго между ягодной нежностью и винно-джиновой дерзостью.',
      650, '{}', true, 9, '[]'::jsonb, '{"weight":250}'::jsonb, 'мл', false);


  -- ── 4. Весенний Special ────────────────────────────────────────────────────
  INSERT INTO dishes (id, tenant_id, category_id, name, description, long_description, price, photos, active, sort_order,
    ingredients, nutrition, weight_unit, requires_kitchen) VALUES
    (gen_random_uuid(), t, cat_spring, 'Клеома',
      'Лаванда, груша, цитрусы, зелень',
      'Назван в честь цветка, который не боится быть замеченным. Вкус — как прогулка по оранжерее: где-то рядом цветёт лаванда, в воздухе витает сладковатый аромат груши, а прохлада цитрусов и зелени напоминает, что весна уже здесь. Лёгкий, искрящийся, с долгим цветочным финалом.',
      850, '{}', true, 1, '[]'::jsonb, '{"weight":430}'::jsonb, 'мл', false),

    (gen_random_uuid(), t, cat_spring, 'Физалис',
      'Травяная свежесть, ягодная кислинка, инжир',
      'Назван в честь цветка, который прячет сладость внутри хрупкой оболочки. Вкус — как первое свидание весной: немного смущающий, с нотками волнения, но до неприличия притягательный. Травяная свежесть переплетается с ягодной кислинкой, а тёплый шлейф инжира добавляет нежности, которой так не хватало зимой. Живой, дерзкий, с долгим послевкусием, которое хочется повторить.',
      500, '{}', true, 2, '[]'::jsonb, '{"weight":120}'::jsonb, 'мл', false),

    (gen_random_uuid(), t, cat_spring, 'Шифердия',
      'Шоколадно-ореховый, с ягодной кислинкой',
      'Названа в честь ягоды, которая прячет яркий вкус за скромной внешностью. Вкус — как поздний весенний вечер, когда солнце уже село, но воздух ещё хранит дневное тепло. Здесь есть что-то шоколадно-ореховое — уютное, обволакивающее, как мягкий плед. А ягодная кислинка и лёгкая горчинка не дают этой нежности превратиться в приторность.',
      500, '{}', true, 3, '[]'::jsonb, '{"weight":300}'::jsonb, 'мл', false),

    (gen_random_uuid(), t, cat_spring, 'Магнолия',
      'Цветочная нежность, фруктовая сочность, пряность',
      'Названа в честь цветка, который распускается одним из первых, не дожидаясь окончательного тепла. Вкус — как момент цветения сакуры: быстротечный, но запоминающийся. Цветочная нежность встречается с фруктовой сочностью, а лёгкая пряная нота добавляет восточного шарма. Игривые пузырьки делают композицию лёгкой, почти невесомой. Магнолия — это весна в её самом изящном проявлении.',
      850, '{}', true, 4, '[]'::jsonb, '{"weight":250}'::jsonb, 'мл', false),

    (gen_random_uuid(), t, cat_spring, 'Плектрантус',
      'Мятная прохлада, сливочная основа',
      'Назван в честь растения, которое наполняет воздух свежестью одним своим присутствием. Вкус — как утренняя роса на молодой зелени: чистая, прозрачная, с лёгкой мятной прохладой. Сливочная основа делает вкус мягким, но не тяжёлым — скорее напоминает облако, в которое приятно провалиться.',
      400, '{}', true, 5, '[]'::jsonb, '{"weight":120}'::jsonb, 'мл', false);


  -- ── 5. Классические коктейли ───────────────────────────────────────────────
  INSERT INTO dishes (id, tenant_id, category_id, name, description, price, photos, active, sort_order,
    ingredients, nutrition, weight_unit, requires_kitchen) VALUES
    (gen_random_uuid(), t, cat_classic_cock, 'Negroni',          'Кампари, джин, мартини россо, ангостура, цедра апельсина',                                            600, '{}', true, 1, '[]'::jsonb, '{"weight":300}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_classic_cock, 'Mai Tai',          'Ром тёмный, ром светлый, оршад, апельсиновый ликёр, сок апельсина и ананаса, сок лайма',              500, '{}', true, 2, '[]'::jsonb, '{"weight":380}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_classic_cock, 'Aperol Spritz',    'Горький аперитив, брют, содовая, апельсин',                                                           650, '{}', true, 3, '[]'::jsonb, '{"weight":450}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_classic_cock, 'Long Island',      'Текила, джин, ром, водка, апельсиновый ликёр, виски, карамель, сок лайма, кола',                       700, '{}', true, 4, '[]'::jsonb, '{"weight":425}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_classic_cock, 'Margarita',        'Текила, апельсиновый ликёр, сахарный сироп, сок лайма, соль',                                         550, '{}', true, 5, '[]'::jsonb, '{"weight":250}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_classic_cock, 'White Russian',    'Водка, кофейный ликёр, мороженое',                                                                    450, '{}', true, 6, '[]'::jsonb, '{"weight":300}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_classic_cock, 'Gin Tonic',        'Джин, тоник, огурец',                                                                                  450, '{}', true, 7, '[]'::jsonb, '{"weight":300}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_classic_cock, 'New York Sour',    'Бурбон, красное сухое вино, сок лимона, сахарный сироп',                                               550, '{}', true, 8, '[]'::jsonb, '{"weight":300}'::jsonb, 'мл', false);


  -- ── 6. Крепкий алкоголь ────────────────────────────────────────────────────

  -- Настойки Онегин (tincture modifier: 50ml / 500ml)
  INSERT INTO dishes (id, tenant_id, category_id, name, description, price, photos, active, sort_order,
    ingredients, nutrition, weight_unit, requires_kitchen) VALUES
    (d_onegin_1, t, cat_spirits, 'Онегин Курага, облепиха и физалис',                    'Настойка Онегин Gourmet', 300, '{}', true,  1, '[]'::jsonb, '{"weight":50}'::jsonb, 'мл', false),
    (d_onegin_2, t, cat_spirits, 'Онегин Вишня, барбарис и гранат',                      'Настойка Онегин Gourmet', 300, '{}', true,  2, '[]'::jsonb, '{"weight":50}'::jsonb, 'мл', false),
    (d_onegin_3, t, cat_spirits, 'Онегин Черноплодная рябина, кедровый орех и бузина',    'Настойка Онегин Gourmet', 300, '{}', true,  3, '[]'::jsonb, '{"weight":50}'::jsonb, 'мл', false),
    (d_onegin_4, t, cat_spirits, 'Онегин Чёрная смородина, ежевика и асаи',              'Настойка Онегин Gourmet', 300, '{}', true,  4, '[]'::jsonb, '{"weight":50}'::jsonb, 'мл', false),
    (d_onegin_5, t, cat_spirits, 'Онегин Яблоко, корица и фейхоа',                       'Настойка Онегин Gourmet', 300, '{}', true,  5, '[]'::jsonb, '{"weight":50}'::jsonb, 'мл', false);

  -- Биттеры / Ликёры / Вермуты (spirit modifier: 50ml / bottle)
  INSERT INTO dishes (id, tenant_id, category_id, name, description, price, photos, active, sort_order,
    ingredients, nutrition, weight_unit, requires_kitchen) VALUES
    (d_campari,    t, cat_spirits, 'Campari',               'Биттер',           300, '{}', true,  6, '[]'::jsonb, '{"weight":50}'::jsonb, 'мл', false),
    (d_aperol,     t, cat_spirits, 'Aperol',                'Ликёр',            340, '{}', true,  7, '[]'::jsonb, '{"weight":50}'::jsonb, 'мл', false),
    (d_cinzano,    t, cat_spirits, 'Cinzano Bianco/Rosso',  'Вермут',           250, '{}', true,  8, '[]'::jsonb, '{"weight":50}'::jsonb, 'мл', false),
    (d_jager,      t, cat_spirits, 'Jagermeister',          'Ликёр',            300, '{}', true,  9, '[]'::jsonb, '{"weight":50}'::jsonb, 'мл', false),
    (d_coffee_liq, t, cat_spirits, 'Coffee ликёр',          'Ликёр кофейный',   250, '{}', true, 10, '[]'::jsonb, '{"weight":50}'::jsonb, 'мл', false);

  -- Бренди / Бурбон / Виски / Коньяк
  INSERT INTO dishes (id, tenant_id, category_id, name, description, price, photos, active, sort_order,
    ingredients, nutrition, weight_unit, requires_kitchen) VALUES
    (d_torres,     t, cat_spirits, 'Torres 10',                  'Бренди, Испания',   400, '{}', true, 11, '[]'::jsonb, '{"weight":50}'::jsonb, 'мл', false),
    (d_jim_beam,   t, cat_spirits, 'Jim Beam',                   'Бурбон, США',       400, '{}', true, 12, '[]'::jsonb, '{"weight":50}'::jsonb, 'мл', false),
    (d_ballantines,t, cat_spirits, 'Ballantines',                'Виски, Шотландия',  350, '{}', true, 13, '[]'::jsonb, '{"weight":50}'::jsonb, 'мл', false),
    (d_jameson,    t, cat_spirits, 'Jameson',                    'Виски, Ирландия',   450, '{}', true, 14, '[]'::jsonb, '{"weight":50}'::jsonb, 'мл', false),
    (d_montifaud,  t, cat_spirits, 'Chateau de Montifaud VS',    'Коньяк, Франция',   950, '{}', true, 15, '[]'::jsonb, '{"weight":50}'::jsonb, 'мл', false);

  -- Джин
  INSERT INTO dishes (id, tenant_id, category_id, name, description, price, photos, active, sort_order,
    ingredients, nutrition, weight_unit, requires_kitchen) VALUES
    (d_barrister, t, cat_spirits, 'Barrister Dry/Pink',          'Джин, в ассортименте',  200, '{}', true, 16, '[]'::jsonb, '{"weight":50}'::jsonb, 'мл', false),
    (d_brecon,    t, cat_spirits, 'Brecon Botanicals',           'Джин, Уэльс',          480, '{}', true, 17, '[]'::jsonb, '{"weight":50}'::jsonb, 'мл', false),
    (d_135east,   t, cat_spirits, '135 East Hyōgo Dry Gin',     'Джин, Япония',          500, '{}', true, 18, '[]'::jsonb, '{"weight":50}'::jsonb, 'мл', false);

  -- Ром / Кальвадос
  INSERT INTO dishes (id, tenant_id, category_id, name, description, price, photos, active, sort_order,
    ingredients, nutrition, weight_unit, requires_kitchen) VALUES
    (d_barcelo,       t, cat_spirits, 'Barcelo Dorado/Blanco',  'Ром, в ассортименте',   250, '{}', true, 19, '[]'::jsonb, '{"weight":50}'::jsonb, 'мл', false),
    (d_contrabando,   t, cat_spirits, 'Contrabando',            'Ром',                   350, '{}', true, 20, '[]'::jsonb, '{"weight":50}'::jsonb, 'мл', false),
    (d_pere_magloire, t, cat_spirits, 'Pere Magloire',          'Кальвадос, Франция',    700, '{}', true, 21, '[]'::jsonb, '{"weight":50}'::jsonb, 'мл', false);

  -- Текила
  INSERT INTO dishes (id, tenant_id, category_id, name, description, price, photos, active, sort_order,
    ingredients, nutrition, weight_unit, requires_kitchen) VALUES
    (d_espolon, t, cat_spirits, 'Espolon Blanco/Reposado',  'Текила, в ассортименте',  400, '{}', true, 22, '[]'::jsonb, '{"weight":50}'::jsonb, 'мл', false),
    (d_onza,    t, cat_spirits, 'Onza Silver/Cold',          'Текила, в ассортименте',  450, '{}', true, 23, '[]'::jsonb, '{"weight":50}'::jsonb, 'мл', false);


  -- ── 7. Пиво ────────────────────────────────────────────────────────────────
  INSERT INTO dishes (id, tenant_id, category_id, name, description, price, photos, active, sort_order,
    ingredients, nutrition, weight_unit, requires_kitchen) VALUES
    (gen_random_uuid(), t, cat_beer, 'Corona Extra',            'Светлое фильтрованное, alc. 4.5%',     400, '{}', true,  1, '[]'::jsonb, '{"weight":330}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_beer, 'Stella Artois',           'Светлое фильтрованное, alc. 5%',       350, '{}', true,  2, '[]'::jsonb, '{"weight":440}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_beer, 'Stella Artois б/а',       'Светлое фильтрованное, безалкогольное', 300, '{}', true,  3, '[]'::jsonb, '{"weight":450}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_beer, 'Крушовице светлое',       'Светлое фильтрованное, alc. 4.2%',     350, '{}', true,  4, '[]'::jsonb, '{"weight":470}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_beer, 'Крушовице тёмное',        'Тёмное фильтрованное, alc. 4.1%',      350, '{}', true,  5, '[]'::jsonb, '{"weight":450}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_beer, 'Spaten',                  'Светлое фильтрованное, alc. 5.2%',     300, '{}', true,  6, '[]'::jsonb, '{"weight":450}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_beer, 'Kilikia Original',        'Светлое фильтрованное, alc. 4.8%',     400, '{}', true,  7, '[]'::jsonb, '{"weight":450}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_beer, 'Kilikia Dark',            'Тёмное фильтрованное, alc. 4.8%',      400, '{}', true,  8, '[]'::jsonb, '{"weight":450}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_beer, 'Clausthaler Original',    'Светлое фильтрованное, безалкогольное', 350, '{}', true,  9, '[]'::jsonb, '{"weight":330}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_beer, 'Meison Arne',             'Светлое фильтрованное, alc. 4.8%',     400, '{}', true, 10, '[]'::jsonb, '{"weight":400}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_beer, 'Шишкин Светлое',          'Lager, alc. 5%',                       400, '{}', true, 11, '[]'::jsonb, '{"weight":500}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_beer, 'Шишкин Тёмное',           'Dark lager, alc. 5%',                  400, '{}', true, 12, '[]'::jsonb, '{"weight":500}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_beer, 'Шишкин Черничный стаут',  'Stout, alc. 6%',                       600, '{}', true, 13, '[]'::jsonb, '{"weight":500}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_beer, 'Шишкин Бон Ананас',       'Fruit beer, alc. 6.5%',                550, '{}', true, 14, '[]'::jsonb, '{"weight":500}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_beer, 'Шишкин Acid Jazz',        'Smoothie sour ale, alc. 6.5%',         600, '{}', true, 15, '[]'::jsonb, '{"weight":500}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_beer, 'JAWS Weizen',             'Пшеничное, alc. 5.6%',                 400, '{}', true, 16, '[]'::jsonb, '{"weight":500}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_beer, 'JAWS Nitro',              'Азотный стаут, alc. 6.0%',             450, '{}', true, 17, '[]'::jsonb, '{"weight":500}'::jsonb, 'мл', false);


  -- ── 8. Mocktails ───────────────────────────────────────────────────────────
  INSERT INTO dishes (id, tenant_id, category_id, name, description, price, photos, active, sort_order,
    ingredients, nutrition, weight_unit, requires_kitchen) VALUES
    (gen_random_uuid(), t, cat_mocktails, 'Бамбуковая роща',        'Джин, сок гуавы, бамбук юдзу',                                            400, '{}', true,  1, '[]'::jsonb, '{"weight":400}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_mocktails, 'Альпийский луг',         'Siberian Aperitif, черника, лаванда, брют',                                400, '{}', true,  2, '[]'::jsonb, '{"weight":160}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_mocktails, 'Ветер сакуры',           'Джин, сакура, сок грейпфрута, брют',                                       400, '{}', true,  3, '[]'::jsonb, '{"weight":400}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_mocktails, 'Граф Негрони',           'Джин, красный вермут, биттер',                                             600, '{}', true,  4, '[]'::jsonb, '{"weight":400}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_mocktails, 'Сады Шираза',            'Жасмин, бузина, тоник, брют',                                              400, '{}', true,  5, '[]'::jsonb, '{"weight":160}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_mocktails, 'Дым Амазонки',           'Джин пало санто-банан, тоник',                                             400, '{}', true,  6, '[]'::jsonb, '{"weight":400}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_mocktails, 'Склоны Крыма',           'Джин, инжирный лист, чабрец',                                              400, '{}', true,  7, '[]'::jsonb, '{"weight":160}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_mocktails, 'Рассвет над Фудзиямой',  'Японский джин, юдзу, бамбук, брют',                                        400, '{}', true,  8, '[]'::jsonb, '{"weight":160}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_mocktails, 'Восточный базар',        'Шотландский виски, ежевика, гранат, сок лимона',                            400, '{}', true,  9, '[]'::jsonb, '{"weight":400}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_mocktails, 'Итальянское солнце',     'Orange Spritz, брют, содовая',                                             650, '{}', true, 10, '[]'::jsonb, '{"weight":450}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_mocktails, 'Вечерняя Флоренция',     'Шотландский виски, итальянский аперитив, клубничное пюре, базилик',         450, '{}', true, 11, '[]'::jsonb, '{"weight":120}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_mocktails, 'Алтайский вечер',        'Siberian Aperitif, цитрусовый ликёр, имбирь, вербена, сок лимона, содовая', 450, '{}', true, 12, '[]'::jsonb, '{"weight":400}'::jsonb, 'мл', false);


  -- ── 9. Авторские лимонады (need lemonade modifier) ─────────────────────────
  INSERT INTO dishes (id, tenant_id, category_id, name, description, long_description, price, photos, active, sort_order,
    ingredients, nutrition, weight_unit, requires_kitchen) VALUES
    (d_lemon_1, t, cat_lemonades, 'Малиновый с барбарисом и кедром',
      'Малина, барбарис, кедр, сычуаньский перец',
      'Пюре малины и барбариса, соус из агавы и кедра, настойка на сычуаньском перце, содовая.',
      300, '{}', true, 1, '[]'::jsonb, '{"weight":450}'::jsonb, 'мл', false),

    (d_lemon_2, t, cat_lemonades, 'Томатный с инжиром и фейхоа',
      'Томат, инжир, фейхоа, корица',
      'Томатный сок, соус из инжира и корицы, пюре фейхоа, содовая.',
      300, '{}', true, 2, '[]'::jsonb, '{"weight":450}'::jsonb, 'мл', false),

    (d_lemon_3, t, cat_lemonades, 'Морковный с манго и юдзу',
      'Морковь, манго, юдзу',
      'Морковный сок, пюре манго и юдзу, сок лимона, содовая.',
      300, '{}', true, 3, '[]'::jsonb, '{"weight":450}'::jsonb, 'мл', false),

    (d_lemon_4, t, cat_lemonades, 'Ежевичный с арахисом',
      'Ежевика, арахис, кокос, гранат',
      'Ежевичное пюре, арахисовый сироп, сок лимона, кокосовая вода с гранатом, содовая.',
      350, '{}', true, 4, '[]'::jsonb, '{"weight":450}'::jsonb, 'мл', false),

    (d_lemon_5, t, cat_lemonades, 'Арбузный с шалфеем',
      'Арбуз, сычуаньский перец, шалфей',
      'Арбузный сок, настой на сычуаньском перце, биттер шалфей, содовая.',
      300, '{}', true, 5, '[]'::jsonb, '{"weight":450}'::jsonb, 'мл', false),

    (d_lemon_6, t, cat_lemonades, 'Грушевый с базиликом',
      'Груша, базилик, лимон',
      'Грушевое пюре, базиликовый сироп, сок лимона, содовая, базилик.',
      300, '{}', true, 6, '[]'::jsonb, '{"weight":450}'::jsonb, 'мл', false),

    (d_lemon_7, t, cat_lemonades, 'Клубничный с киви',
      'Клубника, киви, лимон',
      'Пюре киви, клубничный сироп, клубничное пюре, сок лимона, содовая.',
      300, '{}', true, 7, '[]'::jsonb, '{"weight":450}'::jsonb, 'мл', false),

    (d_lemon_8, t, cat_lemonades, 'Манго с маракуйей',
      'Манго, маракуйя, лимон',
      'Пюре манго и маракуйи, сок лимона, содовая.',
      300, '{}', true, 8, '[]'::jsonb, '{"weight":450}'::jsonb, 'мл', false);


  -- ── 10. Кофе и какао ──────────────────────────────────────────────────────
  INSERT INTO dishes (id, tenant_id, category_id, name, description, price, photos, active, sort_order,
    ingredients, nutrition, weight_unit, requires_kitchen) VALUES
    (gen_random_uuid(), t, cat_coffee, 'Американо',           'Эспрессо, вода',                                      250, '{}', true, 1, '[]'::jsonb, '{"weight":150}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_coffee, 'Капучино',            'Эспрессо, молоко',                                    300, '{}', true, 2, '[]'::jsonb, '{"weight":250}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_coffee, 'Латте',               'Эспрессо, молоко',                                    300, '{}', true, 3, '[]'::jsonb, '{"weight":250}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_coffee, 'Айс-латте',           'Эспрессо, молоко, лёд',                               300, '{}', true, 4, '[]'::jsonb, '{"weight":425}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_coffee, 'Эспрессо-маракуйя',   'Эспрессо, соус из маракуйи, тоник, лайм, лёд',        350, '{}', true, 5, '[]'::jsonb, '{"weight":425}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_coffee, 'Эспрессо-тоник',      'Эспрессо, тоник, содовая, лайм, лёд',                 300, '{}', true, 6, '[]'::jsonb, '{"weight":425}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_coffee, 'Бамбл',               'Эспрессо, солёная карамель, апельсиновый сок, лёд',    350, '{}', true, 7, '[]'::jsonb, '{"weight":425}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_coffee, 'Какао с маршмеллоу',  'Какао, молоко, маршмеллоу',                            200, '{}', true, 8, '[]'::jsonb, '{"weight":425}'::jsonb, 'мл', false);


  -- ── 11. Напитки ────────────────────────────────────────────────────────────
  INSERT INTO dishes (id, tenant_id, category_id, name, description, price, photos, active, sort_order,
    ingredients, nutrition, weight_unit, requires_kitchen) VALUES
    (gen_random_uuid(), t, cat_drinks, 'Сок Rich',                                'В ассортименте',                  150, '{}', true, 1, '[]'::jsonb, '{"weight":500}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_drinks, 'Coca-Cola / Fanta / Sprite / Dr Pepper',  'В ассортименте',                  300, '{}', true, 2, '[]'::jsonb, '{"weight":330}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_drinks, 'Энергетик RedBull',                        'В ассортименте',                  300, '{}', true, 3, '[]'::jsonb, '{"weight":300}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_drinks, 'Вода Тбау',                                'Газированная / негазированная',   200, '{}', true, 4, '[]'::jsonb, '{"weight":500}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_drinks, 'Чай Rich',                                 'В ассортименте',                  200, '{}', true, 5, '[]'::jsonb, '{"weight":500}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_drinks, 'Chupa Chups',                              'В ассортименте',                  300, '{}', true, 6, '[]'::jsonb, '{"weight":500}'::jsonb, 'мл', false);


  -- ── 12. Авторский чай ──────────────────────────────────────────────────────
  INSERT INTO dishes (id, tenant_id, category_id, name, description, long_description, price, photos, active, sort_order,
    ingredients, nutrition, weight_unit, requires_kitchen) VALUES
    (gen_random_uuid(), t, cat_author_tea, 'Тыквенный с облепихой и маракуйей',
      'Молочный улун, облепиха, тыква, маракуйя',
      'Молочный улун, ягоды облепихи, соус из тыквы и маракуйи, специи.',
      550, '{}', true, 1, '[]'::jsonb, '{"weight":1200}'::jsonb, 'мл', false),

    (gen_random_uuid(), t, cat_author_tea, 'Барбарисовый с орхидеей и суданской розой',
      'Суданская роза, барбарис, орхидея, ягоды',
      'Суданская роза, соус из барбариса и орхидеи, ягоды клюквы, клубники и красной смородины.',
      550, '{}', true, 2, '[]'::jsonb, '{"weight":1200}'::jsonb, 'мл', false),

    (gen_random_uuid(), t, cat_author_tea, 'Жасминовый с яблоком и сливой',
      'Жасмин, слива, яблочный сок',
      'Жасминовый концентрат, пюре и плоды сливы, яблочный сок.',
      550, '{}', true, 3, '[]'::jsonb, '{"weight":1200}'::jsonb, 'мл', false),

    (gen_random_uuid(), t, cat_author_tea, 'Пуэр с вишней',
      'Шу пуэр, вишня, бурбонская ваниль',
      'Шу пуэр, ягоды и сок вишни, бурбонская ваниль, специи.',
      650, '{}', true, 4, '[]'::jsonb, '{"weight":1200}'::jsonb, 'мл', false),

    (gen_random_uuid(), t, cat_author_tea, 'Пуэр с сливой и инжиром',
      'Шу пуэр, слива, инжир, ваниль',
      'Шу пуэр, ягоды и соус из сливы с инжиром, бурбонская ваниль, специи.',
      750, '{}', true, 5, '[]'::jsonb, '{"weight":1200}'::jsonb, 'мл', false),

    (gen_random_uuid(), t, cat_author_tea, 'Малиновый с тимьяном и апельсином',
      'Ройбуш, малина, розовый перец, тимьян',
      'Ройбуш, соус из малины и розового перца, апельсин, тимьян.',
      600, '{}', true, 6, '[]'::jsonb, '{"weight":1200}'::jsonb, 'мл', false),

    (gen_random_uuid(), t, cat_author_tea, 'Хурмовый с грушей, берёзовым соком и мёдом',
      'Сенча, хурма, мёд, имбирь, берёзовый сок',
      'Сенча, соус из хурмы, мёда и имбиря со специями, берёзовый сок.',
      600, '{}', true, 7, '[]'::jsonb, '{"weight":1200}'::jsonb, 'мл', false),

    (gen_random_uuid(), t, cat_author_tea, 'Клубничный с кизилом и ванилью',
      'Чёрный чай, клубника, кизил, ваниль',
      'Чёрный чай, соус из клубники, кизила, ванили с тимьяном и специями.',
      600, '{}', true, 8, '[]'::jsonb, '{"weight":1200}'::jsonb, 'мл', false),

    (gen_random_uuid(), t, cat_author_tea, 'Рябиновый с лемонграссом и малиной',
      'Саган-Дайля, рябина, малина, лемонграсс',
      'Саган-Дайля, соус из рябины с малиной и лемонграссом, мёд, специи.',
      600, '{}', true, 9, '[]'::jsonb, '{"weight":1200}'::jsonb, 'мл', false);


  -- ── 13. Классический чай ───────────────────────────────────────────────────
  INSERT INTO dishes (id, tenant_id, category_id, name, description, price, photos, active, sort_order,
    ingredients, nutrition, weight_unit, requires_kitchen) VALUES
    (gen_random_uuid(), t, cat_classic_tea, 'Эрл Грей',         'Цейлонский чёрный чай с натуральным бергамотовым маслом',                            300, '{}', true, 1, '[]'::jsonb, '{"weight":1200}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_classic_tea, 'Гречишный',        'Татарская гречиха, с нотами карамели и шоколада',                                    300, '{}', true, 2, '[]'::jsonb, '{"weight":1200}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_classic_tea, 'Ройбуш',           'Сладковатый вкус, древесно-ореховый аромат. Без кофеина',                            300, '{}', true, 3, '[]'::jsonb, '{"weight":1200}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_classic_tea, 'Саган-дайля',      'Природный энергетик с берегов Байкала. Хвоя, фруктовая кислинка, свежесть мяты',     300, '{}', true, 4, '[]'::jsonb, '{"weight":1200}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_classic_tea, 'Таёжный',          'Ассам, мята, можжевельник, шиповник, чабрец, васильки, брусника',                     300, '{}', true, 5, '[]'::jsonb, '{"weight":1200}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_classic_tea, 'Молочный улун',    'Зелёный ароматизированный с молочно-карамельным вкусом',                              300, '{}', true, 6, '[]'::jsonb, '{"weight":1200}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_classic_tea, 'Жасминовый улун',  'Зелёный освежающий, с горчинкой и сладковатыми нотами жасмина',                       300, '{}', true, 7, '[]'::jsonb, '{"weight":1200}'::jsonb, 'мл', false),
    (gen_random_uuid(), t, cat_classic_tea, 'Кенийский чёрный', 'Насыщенный золотисто-красный, терпкий, с медовым ароматом',                           300, '{}', true, 8, '[]'::jsonb, '{"weight":1200}'::jsonb, 'мл', false);


  -- ── 14. Китайский чай ──────────────────────────────────────────────────────
  INSERT INTO dishes (id, tenant_id, category_id, name, description, long_description, price, photos, active, sort_order,
    ingredients, nutrition, weight_unit, requires_kitchen) VALUES
    (gen_random_uuid(), t, cat_chinese_tea, 'Дянь Хун Маофэн',
      'Красный чай, Юньнань. Шоколадно-кэробные и медово-ореховые оттенки',
      'Родом из провинции Юньнань, которая славится не только своими пуэрами, но и красными чаями. Их приятная терпкость, невероятный аромат, доброе согревающее воздействие и обилие самых разных оттенков: от шоколадно-кэробных до медово-ореховых.',
      400, '{}', true, 1, '[]'::jsonb, '{"weight":1200}'::jsonb, 'мл', false),

    (gen_random_uuid(), t, cat_chinese_tea, 'Тайваньская красная Габа',
      'Горы Алишань. Сладковатый вкус с молочными нотками и цветочным ароматом',
      'Этот чай был выращен в горах Алишань (округ Наньтхоу, Тайвань), обработан по современным технологиям, особенностью которых является ферментация без доступа кислорода. Результатом бескислородной ферментации является высокое содержание ГАМК. При заваривании получается прекрасный напиток с ярким, чуть сладковатым вкусом с молочными нотками, кислинкой и цветочным ароматом.',
      550, '{}', true, 2, '[]'::jsonb, '{"weight":1200}'::jsonb, 'мл', false),

    (gen_random_uuid(), t, cat_chinese_tea, 'Цзинь Цзюнь Мэй',
      'Красный чай, Фуцзянь. Сладкий, карамельный, с нотами клубники',
      'Китайский красный чай с севера провинции Фуцзянь. Классическое согревающее действие красного чая, но при этом расслабляющее и успокаивающее. Аромат сложный, богатый и нежный. Нотки хлеба и шоколада переплетаются с запахом клубники. Вкус сладкий, чистый, сдобно-вареньевый, карамельный. Долгое, приятное послевкусие с кисло-сладким фоном.',
      400, '{}', true, 3, '[]'::jsonb, '{"weight":1200}'::jsonb, 'мл', false),

    (gen_random_uuid(), t, cat_chinese_tea, 'Фэн Хуан Дань Цун',
      'Красный чай, Гуандун. Кофейные оттенки с цветами, медовое послевкусие',
      'Красный чай из провинции Гуандун. Он душа компании, смело можно брать для чаепития с друзьями, подарит лёгкое, спокойное состояние и уберёт ненужные мысли. Аромат с глубокими древесными нотками и медово-цветочными, травянистыми оттенками. Во вкусе переливы кофейных оттенков с цветами. В проливах раскрывается сухая корочка хлеба, оставляет приятное сладковатое послевкусие.',
      400, '{}', true, 4, '[]'::jsonb, '{"weight":1200}'::jsonb, 'мл', false),

    (gen_random_uuid(), t, cat_chinese_tea, 'Да Хун Пао',
      'Утёсный улун, горы Уи. Печёные фрукты, карамель, орехи',
      'Утёсный китайский улун, произведённый на северо-западе провинции Фуцзянь, в горах Уи. Гармонизирует эмоциональное состояние, улучшает концентрацию внимания, расслабляет. Стойкий аромат с нотами жареных орехов, пряностей и табака. Во вкусе пряные печёные фрукты, карамель и хлебные корочки с лёгкой терпкостью. Обладает долгим объёмным послевкусием.',
      350, '{}', true, 5, '[]'::jsonb, '{"weight":1200}'::jsonb, 'мл', false),

    (gen_random_uuid(), t, cat_chinese_tea, 'Юньнань Пуэр',
      'Классический шу пуэр. Благородное дерево, ореховые нотки',
      'Классический повседневный шу пуэр из провинции Юньнань. Красивый и ровный, но при этом глубокий аромат мокрого благородного дерева с лёгкими ненавязчивыми землистыми нотками толчёного ореха и длительным послевкусием.',
      400, '{}', true, 6, '[]'::jsonb, '{"weight":1200}'::jsonb, 'мл', false),

    (gen_random_uuid(), t, cat_chinese_tea, 'Жареный Те Гуань Инь',
      'Улун, Фуцзянь. Копчёно-дымный аромат, специи, шоколад, цветы',
      'Улун из уезда Аньси, провинции Фуцзянь, запечённый по старинной технологии на углях. При заваривании листья имеют особый копчёно-дымный аромат, настой янтарного цвета. Во вкусе специи, шоколад, цветы.',
      400, '{}', true, 7, '[]'::jsonb, '{"weight":1200}'::jsonb, 'мл', false),

    (gen_random_uuid(), t, cat_chinese_tea, 'Те Гуань Инь',
      'Бирюзовый улун. Цветущая сирень, сладость, чайное опьянение',
      'Знаменитый бирюзовый улун, содержащий немало алкалоидов, которые при растворении в горячей воде дарят удивительные метаморфозы сознанию. Чувство приятной, лёгкой эйфории также называют состоянием «чайного опьянения», в котором улучшается настроение и повышается работоспособность. В аромате свежие ноты цветущей сирени, сладость во вкусе.',
      400, '{}', true, 8, '[]'::jsonb, '{"weight":1200}'::jsonb, 'мл', false),

    (gen_random_uuid(), t, cat_chinese_tea, 'Сенча',
      'Зелёный чай, Сычуань. Яркий, мягкий вкус классической сенчи',
      'Китайский зелёный чай из провинции Сычуань. Вкус классической сенчи с ярким, мягким послевкусием.',
      400, '{}', true, 9, '[]'::jsonb, '{"weight":1200}'::jsonb, 'мл', false);


  -- ── 15. Закуски ────────────────────────────────────────────────────────────
  INSERT INTO dishes (id, tenant_id, category_id, name, description, price, photos, active, sort_order,
    ingredients, nutrition, weight_unit, requires_kitchen) VALUES
    (gen_random_uuid(), t, cat_snacks, 'Сэндвич',                                         'В ассортименте',                                      300, '{}', true, 1, '[]'::jsonb, '{"weight":175}'::jsonb, 'г', true),
    (gen_random_uuid(), t, cat_snacks, 'Сэндвич с картофелем фри',                         'Сэндвич + картофель фри',                             400, '{}', true, 2, '[]'::jsonb, '{"weight":275}'::jsonb, 'г', true),
    (gen_random_uuid(), t, cat_snacks, 'Сэндвич с черри и салатом',                         'Сэндвич с томатами черри и салатом',                   450, '{}', true, 3, '[]'::jsonb, '{"weight":275}'::jsonb, 'г', true),
    (gen_random_uuid(), t, cat_snacks, 'Картофель фри',                                    'Классический картофель фри',                          250, '{}', true, 4, '[]'::jsonb, '{"weight":200}'::jsonb, 'г', true),
    (gen_random_uuid(), t, cat_snacks, 'Ассорти закусок',                                  'Фуэт, сыр, вяленые томаты, финики, оливки, груша',   600, '{}', true, 5, '[]'::jsonb, '{"weight":300}'::jsonb, 'г', true),
    (gen_random_uuid(), t, cat_snacks, 'Ореховый сет',                                     'Кешью, миндаль, фисташки, грецкий орех',              700, '{}', true, 6, '[]'::jsonb, '{"weight":200}'::jsonb, 'г', true),
    (gen_random_uuid(), t, cat_snacks, 'Батат фри с пармезаном и трюфельным маслом',       'Батат фри, пармезан, трюфельное масло',               350, '{}', true, 7, '[]'::jsonb, '{"weight":130}'::jsonb, 'г', true);


  -- ── 16. Десерты ────────────────────────────────────────────────────────────
  INSERT INTO dishes (id, tenant_id, category_id, name, description, price, photos, active, sort_order,
    ingredients, nutrition, weight_unit, requires_kitchen) VALUES
    (gen_random_uuid(), t, cat_desserts, 'Чизкейк',             'В ассортименте',   400, '{}', true, 1, '[]'::jsonb, '{}'::jsonb, 'г', true),
    (gen_random_uuid(), t, cat_desserts, 'Шоколад Ritter Sport', 'В ассортименте',   300, '{}', true, 2, '[]'::jsonb, '{}'::jsonb, 'г', true);


  -- ════════════════════════════════════════════════════════════════════════════
  -- MODIFIER LINKAGES
  -- ════════════════════════════════════════════════════════════════════════════

  -- ── Wine modifier (glass / bottle) ─────────────────────────────────────────
  INSERT INTO dish_modifier_groups (dish_id, group_id, sort_order) VALUES
    (d_wine_cielo,      mg_wine_vol, 1),
    (d_wine_uby,        mg_wine_vol, 1),
    (d_wine_esse,       mg_wine_vol, 1),
    (d_wine_nobilomo_r, mg_wine_vol, 1),
    (d_wine_undurraga,  mg_wine_vol, 1),
    (d_wine_askaneli,   mg_wine_vol, 1),
    (d_wine_nobilomo_w, mg_wine_vol, 1),
    (d_wine_weinkeller, mg_wine_vol, 1),
    (d_wine_airen,      mg_wine_vol, 1),
    (d_wine_reinhard,   mg_wine_vol, 1),
    (d_wine_contrasena, mg_wine_vol, 1),
    (d_wine_jpchanet,   mg_wine_vol, 1);

  INSERT INTO dish_modifier_options (dish_id, option_id, price_delta, is_default, sort_order, weight) VALUES
    (d_wine_cielo,      mo_wine_glass,    0, true,  1, 125),
    (d_wine_cielo,      mo_wine_bottle, 2150, false, 2, 750),
    (d_wine_uby,        mo_wine_glass,    0, true,  1, 125),
    (d_wine_uby,        mo_wine_bottle, 3000, false, 2, 750),
    (d_wine_esse,       mo_wine_glass,    0, true,  1, 125),
    (d_wine_esse,       mo_wine_bottle, 3330, false, 2, 750),
    (d_wine_nobilomo_r, mo_wine_glass,    0, true,  1, 125),
    (d_wine_nobilomo_r, mo_wine_bottle, 2910, false, 2, 750),
    (d_wine_undurraga,  mo_wine_glass,    0, true,  1, 125),
    (d_wine_undurraga,  mo_wine_bottle, 2050, false, 2, 750),
    (d_wine_askaneli,   mo_wine_glass,    0, true,  1, 125),
    (d_wine_askaneli,   mo_wine_bottle, 2050, false, 2, 750),
    (d_wine_nobilomo_w, mo_wine_glass,    0, true,  1, 125),
    (d_wine_nobilomo_w, mo_wine_bottle, 2910, false, 2, 750),
    (d_wine_weinkeller, mo_wine_glass,    0, true,  1, 125),
    (d_wine_weinkeller, mo_wine_bottle, 2910, false, 2, 750),
    (d_wine_airen,      mo_wine_glass,    0, true,  1, 125),
    (d_wine_airen,      mo_wine_bottle, 2000, false, 2, 750),
    (d_wine_reinhard,   mo_wine_glass,    0, true,  1, 125),
    (d_wine_reinhard,   mo_wine_bottle, 2240, false, 2, 750),
    (d_wine_contrasena, mo_wine_glass,    0, true,  1, 125),
    (d_wine_contrasena, mo_wine_bottle, 2240, false, 2, 750),
    (d_wine_jpchanet,   mo_wine_glass,    0, true,  1, 125),
    (d_wine_jpchanet,   mo_wine_bottle, 2000, false, 2, 750);


  -- ── Tincture modifier (Онегин: 50ml / 500ml, delta 2700) ──────────────────
  INSERT INTO dish_modifier_groups (dish_id, group_id, sort_order) VALUES
    (d_onegin_1, mg_tincture_vol, 1),
    (d_onegin_2, mg_tincture_vol, 1),
    (d_onegin_3, mg_tincture_vol, 1),
    (d_onegin_4, mg_tincture_vol, 1),
    (d_onegin_5, mg_tincture_vol, 1);

  INSERT INTO dish_modifier_options (dish_id, option_id, price_delta, is_default, sort_order, weight) VALUES
    (d_onegin_1, mo_tinct_shot, 0,    true,  1, 50),
    (d_onegin_1, mo_tinct_500,  2700, false, 2, 500),
    (d_onegin_2, mo_tinct_shot, 0,    true,  1, 50),
    (d_onegin_2, mo_tinct_500,  2700, false, 2, 500),
    (d_onegin_3, mo_tinct_shot, 0,    true,  1, 50),
    (d_onegin_3, mo_tinct_500,  2700, false, 2, 500),
    (d_onegin_4, mo_tinct_shot, 0,    true,  1, 50),
    (d_onegin_4, mo_tinct_500,  2700, false, 2, 500),
    (d_onegin_5, mo_tinct_shot, 0,    true,  1, 50),
    (d_onegin_5, mo_tinct_500,  2700, false, 2, 500);


  -- ── Spirit modifier (50ml / bottle) ────────────────────────────────────────
  INSERT INTO dish_modifier_groups (dish_id, group_id, sort_order) VALUES
    (d_campari,       mg_spirit_vol, 1),
    (d_aperol,        mg_spirit_vol, 1),
    (d_cinzano,       mg_spirit_vol, 1),
    (d_jager,         mg_spirit_vol, 1),
    (d_coffee_liq,    mg_spirit_vol, 1),
    (d_torres,        mg_spirit_vol, 1),
    (d_jim_beam,      mg_spirit_vol, 1),
    (d_ballantines,   mg_spirit_vol, 1),
    (d_jameson,       mg_spirit_vol, 1),
    (d_montifaud,     mg_spirit_vol, 1),
    (d_barrister,     mg_spirit_vol, 1),
    (d_brecon,        mg_spirit_vol, 1),
    (d_135east,       mg_spirit_vol, 1),
    (d_barcelo,       mg_spirit_vol, 1),
    (d_contrabando,   mg_spirit_vol, 1),
    (d_pere_magloire, mg_spirit_vol, 1),
    (d_espolon,       mg_spirit_vol, 1),
    (d_onza,          mg_spirit_vol, 1);

  INSERT INTO dish_modifier_options (dish_id, option_id, price_delta, is_default, sort_order, weight) VALUES
    (d_campari,       mo_spirit_shot,     0, true,  1, 50),
    (d_campari,       mo_spirit_bottle, 3900, false, 2, 750),
    (d_aperol,        mo_spirit_shot,     0, true,  1, 50),
    (d_aperol,        mo_spirit_bottle, 4360, false, 2, 700),
    (d_cinzano,       mo_spirit_shot,     0, true,  1, 50),
    (d_cinzano,       mo_spirit_bottle, 4750, false, 2, 1000),
    (d_jager,         mo_spirit_shot,     0, true,  1, 50),
    (d_jager,         mo_spirit_bottle, 3900, false, 2, 700),
    (d_coffee_liq,    mo_spirit_shot,     0, true,  1, 50),
    (d_coffee_liq,    mo_spirit_bottle, 3500, false, 2, 750),
    (d_torres,        mo_spirit_shot,     0, true,  1, 50),
    (d_torres,        mo_spirit_bottle, 5200, false, 2, 700),
    (d_jim_beam,      mo_spirit_shot,     0, true,  1, 50),
    (d_jim_beam,      mo_spirit_bottle, 7600, false, 2, 1000),
    (d_ballantines,   mo_spirit_shot,     0, true,  1, 50),
    (d_ballantines,   mo_spirit_bottle, 4550, false, 2, 700),
    (d_jameson,       mo_spirit_shot,     0, true,  1, 50),
    (d_jameson,       mo_spirit_bottle, 5350, false, 2, 700),
    (d_montifaud,     mo_spirit_shot,      0, true,  1, 50),
    (d_montifaud,     mo_spirit_bottle, 12550, false, 2, 700),
    (d_barrister,     mo_spirit_shot,     0, true,  1, 50),
    (d_barrister,     mo_spirit_bottle, 2600, false, 2, 700),
    (d_brecon,        mo_spirit_shot,     0, true,  1, 50),
    (d_brecon,        mo_spirit_bottle, 6120, false, 2, 700),
    (d_135east,       mo_spirit_shot,     0, true,  1, 50),
    (d_135east,       mo_spirit_bottle, 6500, false, 2, 700),
    (d_barcelo,       mo_spirit_shot,     0, true,  1, 50),
    (d_barcelo,       mo_spirit_bottle, 3750, false, 2, 1000),
    (d_contrabando,   mo_spirit_shot,     0, true,  1, 50),
    (d_contrabando,   mo_spirit_bottle, 4650, false, 2, 700),
    (d_pere_magloire, mo_spirit_shot,     0, true,  1, 50),
    (d_pere_magloire, mo_spirit_bottle, 9100, false, 2, 700),
    (d_espolon,       mo_spirit_shot,     0, true,  1, 50),
    (d_espolon,       mo_spirit_bottle, 5600, false, 2, 750),
    (d_onza,          mo_spirit_shot,     0, true,  1, 50),
    (d_onza,          mo_spirit_bottle, 5850, false, 2, 700);


  -- ── Lemonade modifier (450ml / 1500ml) ─────────────────────────────────────
  INSERT INTO dish_modifier_groups (dish_id, group_id, sort_order) VALUES
    (d_lemon_1, mg_lemonade_vol, 1),
    (d_lemon_2, mg_lemonade_vol, 1),
    (d_lemon_3, mg_lemonade_vol, 1),
    (d_lemon_4, mg_lemonade_vol, 1),
    (d_lemon_5, mg_lemonade_vol, 1),
    (d_lemon_6, mg_lemonade_vol, 1),
    (d_lemon_7, mg_lemonade_vol, 1),
    (d_lemon_8, mg_lemonade_vol, 1);

  INSERT INTO dish_modifier_options (dish_id, option_id, price_delta, is_default, sort_order, weight) VALUES
    (d_lemon_1, mo_lemon_small,   0, true,  1, 450),
    (d_lemon_1, mo_lemon_big,   400, false, 2, 1500),
    (d_lemon_2, mo_lemon_small,   0, true,  1, 450),
    (d_lemon_2, mo_lemon_big,   400, false, 2, 1500),
    (d_lemon_3, mo_lemon_small,   0, true,  1, 450),
    (d_lemon_3, mo_lemon_big,   400, false, 2, 1500),
    (d_lemon_4, mo_lemon_small,   0, true,  1, 450),
    (d_lemon_4, mo_lemon_big,   500, false, 2, 1500),
    (d_lemon_5, mo_lemon_small,   0, true,  1, 450),
    (d_lemon_5, mo_lemon_big,   300, false, 2, 1500),
    (d_lemon_6, mo_lemon_small,   0, true,  1, 450),
    (d_lemon_6, mo_lemon_big,   300, false, 2, 1500),
    (d_lemon_7, mo_lemon_small,   0, true,  1, 450),
    (d_lemon_7, mo_lemon_big,   400, false, 2, 1500),
    (d_lemon_8, mo_lemon_small,   0, true,  1, 450),
    (d_lemon_8, mo_lemon_big,   400, false, 2, 1500);


  RAISE NOTICE 'Menu seeded for Дымовая (tenant: %)!', t;

END $$;
