-- =============================================================================
-- FASTIO E2E CI SEED — config-faithful дамп тенантов demo (retail) + services-start (services)
-- =============================================================================
-- АВТОГЕНЕРАЦИЯ: scripts/e2e/gen-e2e-seed.sh. Руками не править — перегенерируй.
-- Применяется в CI (e2e-smoke.yml / e2e-nightly.yml) на свежую базу после supabase start,
-- ДО globalSetup (scripts/e2e/setup.mjs), который досоздаёт customer/session и ресетит пароль.
-- Воспроизводит локальное состояние, на котором проходят tests/e2e/*. Без транзакционной
-- истории. Триггеры отключены на время загрузки (session_replication_role=replica).
-- НЕ для прода — синтетические demo-данные.
-- =============================================================================

SET session_replication_role = replica;
BEGIN;

-- auth.users
COPY auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,invited_at,confirmation_token,confirmation_sent_at,recovery_token,recovery_sent_at,email_change_token_new,email_change,email_change_sent_at,last_sign_in_at,raw_app_meta_data,raw_user_meta_data,is_super_admin,created_at,updated_at,phone,phone_confirmed_at,phone_change,phone_change_token,phone_change_sent_at,email_change_token_current,email_change_confirm_status,banned_until,reauthentication_token,reauthentication_sent_at,is_sso_user,deleted_at,is_anonymous) FROM stdin;
00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000001	authenticated	authenticated	demo@fastio.app	$2a$06$.vBjrdtvgLMMmDe1E4vQPOL39RPRwdFtBnNlJubcOLuLdai1pjud.	2026-03-09 11:16:17.049971+00	\N		\N		\N			\N	2026-05-31 13:13:13.896942+00	{"provider": "email", "providers": ["email"]}	{"full_name": "Demo Owner"}	f	2026-03-09 11:16:17.049971+00	2026-06-03 08:29:52.889321+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	a0fc6305-3212-4ab7-a24c-241eda32dd97	authenticated	authenticated	services-start@gmail.com	$2a$10$xdeplUS8HbdrF6n4748jlupMbvcV3FXgiDvwXKj8Rcksl/E.5SkUq	2026-04-22 10:48:50.407326+00	\N		\N		\N			\N	2026-05-03 13:57:51.944906+00	{"provider": "email", "providers": ["email"]}	{"email_verified": true}	\N	2026-04-22 10:48:50.405489+00	2026-05-04 01:03:19.356023+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	7642ed14-e24c-40b0-9d15-d43740acc06d	authenticated	authenticated	anna.petrova@services-start.local	$2a$06$FGmk/5Pd9tw5EQ/ouKBaJeMav2aHXLVUwcggoPM/5RBh.zRsAkxEi	2026-04-28 05:46:17.588934+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"provider": "email", "providers": ["email"]}	{"name": "Анна Петрова"}	\N	2026-04-28 05:46:17.588934+00	2026-04-28 05:46:17.588934+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	faf8224b-6b91-4520-89a1-cdf84d278178	authenticated	authenticated	dmitry.sidorov@services-start.local	$2a$06$MdVH1NAVOtN/AUcbjU1dYuyO8ObbcdIU6mo8e5gw3Cd3Hk0EL7KR2	2026-04-28 05:46:17.588934+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"provider": "email", "providers": ["email"]}	{"name": "Дмитрий Сидоров"}	\N	2026-04-28 05:46:17.588934+00	2026-04-28 05:46:17.588934+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	94483987-838c-493e-944a-06f3b4e477e7	authenticated	authenticated	elena.kozlova@services-start.local	$2a$06$9qgntjg8JiviBnUmlLGVcu0lwMPOt6z8QF.1S/8bUzlHzBZYNHO/G	2026-04-28 05:46:17.588934+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"provider": "email", "providers": ["email"]}	{"name": "Елена Козлова"}	\N	2026-04-28 05:46:17.588934+00	2026-04-28 05:46:17.588934+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	027da995-8596-4ead-a1af-4126257070a5	authenticated	authenticated	maxim.volkov@services-start.local	$2a$06$fCPK3p3ptQCJLBfOCOvdUOlhehJ5DO1nxXM45yIOAUR9LU753vYJ.	2026-04-28 05:46:17.588934+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"provider": "email", "providers": ["email"]}	{"name": "Максим Волков"}	\N	2026-04-28 05:46:17.588934+00	2026-04-28 05:46:17.588934+00	\N	\N			\N		0	\N		\N	f	\N	f
\.

-- auth.identities
COPY auth.identities (provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at,id) FROM stdin;
demo@fastio.app	00000000-0000-0000-0000-000000000001	{"sub": "00000000-0000-0000-0000-000000000001", "email": "demo@fastio.app"}	email	2026-03-09 11:16:17.053968+00	2026-03-09 11:16:17.053968+00	2026-03-09 11:16:17.053968+00	00000000-0000-0000-0000-000000000001
a0fc6305-3212-4ab7-a24c-241eda32dd97	a0fc6305-3212-4ab7-a24c-241eda32dd97	{"sub": "a0fc6305-3212-4ab7-a24c-241eda32dd97", "email": "services-start@gmail.com", "email_verified": false, "phone_verified": false}	email	2026-04-22 10:48:50.406242+00	2026-04-22 10:48:50.406257+00	2026-04-22 10:48:50.406257+00	13bec736-fa21-49c9-933f-fcb2f8746a8b
\.

-- public.tenants
COPY public.tenants (id,owner_id,name,slug,custom_domain,theme,contacts,notifications,subscription,delivery_min_order,delivery_fee,created_at,updated_at,delivery_description,site_layout,site_content,currency,business_type,seo,modules,balance,kitchen_urgency_minutes,kitchen_config,order_number_config,working_hours_schedule,onboarding_completed,timezone,max_addons_default,delivery_mode,free_delivery_from,order_scheduling_config,legal_info,menu_style,self_registered,onboarding_state,payment_methods,branch_selection_mode,color_palettes,orders_tile_size) FROM stdin;
00000000-0000-0000-0000-000000000002	00000000-0000-0000-0000-000000000001	Вкусная точка	demo	\N	{"layout": "multipage", "preset": "fresh", "palette": {"bg": "#ffffff", "text": "#111111", "border": "#e0e0e0", "primary": "#ff6b35", "surface": "#f5f5f5", "textMuted": "#999999", "textSecondary": "#666666"}, "cardRadius": 8, "cardShadow": "subtle", "fontFamily": "Neucha", "buttonRadius": "pill", "customThemes": [{"id": "1773375426897", "name": "Тема 2", "basedOn": "fresh", "palette": {"bg": "#ffffff", "text": "#111111", "border": "#e0e0e0", "primary": "#ff6b35", "surface": "#f5f5f5", "textMuted": "#999999", "textSecondary": "#666666"}}, {"id": "47f9bfb9-3a8b-4f9b-a7fa-4a89e0170f04", "name": "уцацу", "basedOn": "slate", "palette": {"bg": "#4fde81", "text": "#000000", "border": "#334155", "primary": "#07eda8", "surface": "#ffdd80", "textMuted": "#64748b", "textSecondary": "#1a0a0a"}}], "primaryColor": "#ff6b35", "activeCustomId": null, "headingFontFamily": "Comfortaa"}	{"vk": "йцуйцуйц", "max": "23432423", "email": "demo@fastio.app", "phone": "+7 (900) 123-45-88", "address": "", "offerUrl": "http://127.0.0.1:54321/storage/v1/object/public/documents/00000000-0000-0000-0000-000000000002/offer.pdf?t=1776325751789", "telegram": "уцкуцкууцк", "whatsapp": "234234234324", "instagram": "йцуйцу", "privacyUrl": "http://127.0.0.1:54321/storage/v1/object/public/documents/00000000-0000-0000-0000-000000000002/privacy.pdf"}	{"email": null}	{"plan": "retail-pro", "status": "active", "renewsAt": "2026-06-22T03:11:43Z", "pastDueAt": null, "trialEndsAt": null}	500.00	198.00	2026-03-09 11:16:17.054289+00	2026-06-01 10:47:53.676581+00	Доставка от 500 ₽. Бесплатно от 2000 ₽	{"pages": ["menu", "delivery", "about"], "header": {"showNav": true, "navItems": [{"key": "menu", "action": "scroll"}, {"key": "reviews", "action": "scroll"}, {"key": "delivery", "action": "navigate"}, {"key": "gallery", "action": "scroll"}], "navPages": ["menu", "delivery", "contacts", "booking"], "showPhone": true, "showWorkingHours": false}, "pageMode": "multipage", "sections": {"hero": {"size": "content", "bgType": "image", "enabled": false, "patternId": "sparkles", "gradientId": "radial-tl", "contentAlign": "center", "overlayColor": "#000000", "patternColor": "#000000", "overlayOpacity": 0.5, "contentPosition": 5}, "menu": {"enabled": true, "defaultView": "dishes", "mobileDishCard": "horizontal", "tagDisplayMode": "both", "dishDescriptionMode": "below"}, "banners": {"enabled": true, "autoplay": true, "displayMode": "single", "autoplayInterval": 8}, "gallery": {"enabled": true, "galleryIds": ["43e5f417-3b5b-4a18-b384-d3e0fc414ff0"]}, "reviews": {"enabled": false}, "delivery": {"enabled": false}, "vacancies": {"enabled": false}, "categoryBar": {"enabled": false, "overflow": "scroll"}}, "pageSettings": {"menu": {"defaultView": "categories", "mobileDishCard": "vertical", "tagDisplayMode": "both", "dishDescriptionMode": "below"}, "gallery": {"galleryIds": ["43e5f417-3b5b-4a18-b384-d3e0fc414ff0", "d92e26ac-12dd-499e-a89b-dfa64b9efde7"]}, "delivery": {"showMap": true, "descriptionMode": "auto"}}, "sectionsOrder": ["categoryBar", "hero", "gallery", "menu", "banners", "reviews"]}	{"hero": {"text": "<h1><span style=\\"font-size: 120px; color: var(--primary);\\"><strong><em>Лосось на палочке</em></strong></span></h1><hr><p><span style=\\"color: var(--color-text);\\"><br></span><span style=\\"font-size: 48px; color: var(--primary);\\">Не доставляем пиццу<br>Доставляем удовольствие<br><br><br><br></span></p><p></p>", "bgUrl": "http://127.0.0.1:54321/storage/v1/object/public/tenant-assets/00000000-0000-0000-0000-000000000002/hero-bg.webp?t=1773750314144"}, "logo": "http://127.0.0.1:54321/storage/v1/object/public/tenant-assets/00000000-0000-0000-0000-000000000002/logo.webp?t=1774599333422", "about": {"text": "<p>йгншпа агшуйпа гшуа<br>цушагпшгцуа э<br>гцупашгуцпа</p>", "coverUrl": "http://127.0.0.1:54321/storage/v1/object/public/tenant-assets/00000000-0000-0000-0000-000000000002/about-cover.webp?t=1774489756113"}, "banners": [{"url": "http://127.0.0.1:54321/storage/v1/object/public/tenant-assets/00000000-0000-0000-0000-000000000002/banner-0.webp?t=1773319533246", "enabled": true}, {"url": "http://127.0.0.1:54321/storage/v1/object/public/tenant-assets/00000000-0000-0000-0000-000000000002/banner-1.webp?t=1774361723561", "enabled": true}], "delivery": {"manualText": ""}}	₽	retail	{"robots": "index", "favicon": "http://127.0.0.1:54321/storage/v1/object/public/tenant-assets/00000000-0000-0000-0000-000000000002/favicon.webp?t=1774853240267", "ogImage": null, "metaTitle": "Ангры пизза", "metaDescription": "цгуарпшгцуа цушгапр уцшгапуц ашуцгп ашгуцап цушг а", "yandexMetrikaId": null, "googleAnalyticsId": null}	{"addons": true, "combos": true, "dineIn": true, "pickup": true, "kitchen": true, "branches": false, "delivery": true, "services": false, "customers": true, "modifiers": true, "promotions": true, "customRoles": true, "reservations": true}	2475	90	{"sourceStatusId": "00000000-0000-0000-0001-000000000002", "cookingStatusId": "00000000-0000-0000-0001-000000000003", "completedStatusMap": {"pickup": "00000000-0000-0000-0001-000000000004", "dine_in": null, "delivery": "00000000-0000-0000-0001-000000000005"}}	{"scope": "global", "format": "prefix_counter", "prefix": "ОПП", "padLength": 5, "startFrom": 1, "dateFormat": "DDMM", "resetPeriod": "never"}	{"days": {}, "default": {"open": "12:00", "close": "03:00"}}	t	Asia/Krasnoyarsk	3	fixed	1200	{"enabled": true, "slotStep": 60, "daysAhead": 1, "pickupLeadMinutes": 60, "closeBufferMinutes": 120, "deliveryLeadMinutes": 60}	{"inn": "123123123123", "ogrn": "1232132123123", "legalName": "ИП Говнов Петр Иваныч", "legalAddress": "пжашг1п2 12131415", "privacyEmail": "ev@gmail.com"}	food	f	{"completed_at": null, "dismissed_at": null, "completed_steps": []}	{cash,card}	unified	{}	m
b1000000-0000-0000-0000-000000000005	a0fc6305-3212-4ab7-a24c-241eda32dd97	services-start	services-start	\N	{"preset": "espresso", "palette": {"bg": "#140c08", "text": "#f5ede0", "border": "#302018", "primary": "#c8a070", "surface": "#201410", "textMuted": "#806040", "textSecondary": "#c0a880"}, "cardRadius": 14, "cardShadow": "subtle", "fontFamily": "system", "buttonRadius": "rounded", "customThemes": [], "primaryColor": "#c8a070", "activeCustomId": null, "headingFontFamily": "system"}	{"vk": null, "max": null, "email": "", "phone": "+7 (878) 978-97-97", "address": "", "offerUrl": null, "telegram": null, "whatsapp": null, "instagram": null}	{"email": null}	{"plan": "services-start", "status": "past_due", "renewsAt": null, "pastDueAt": "2026-05-12T04:14:55Z", "trialEndsAt": "2026-05-11T11:22:23Z", "gracePeriodDays": 3}	0.00	0.00	2026-04-22 10:49:28.555689+00	2026-05-17 03:59:26.729727+00		{"pages": ["menu"], "header": {"showNav": true, "navItems": [], "showPhone": true, "showWorkingHours": true}, "sections": {"hero": {"size": "fullscreen", "bgType": "none", "enabled": false, "gradientId": "diag-bp", "contentAlign": "left", "overlayColor": "#000000", "overlayOpacity": 0.4, "contentPosition": 5}, "menu": {"enabled": true, "defaultView": "categories", "mobileDishCard": "vertical", "tagDisplayMode": "both", "dishDescriptionMode": "below"}, "banners": {"enabled": false, "autoplay": false, "displayMode": "single", "autoplayInterval": 4}, "gallery": {"enabled": false, "galleryIds": []}, "reviews": {"enabled": false}, "delivery": {"enabled": false}, "categoryBar": {"enabled": true, "overflow": "scroll"}}, "pageSettings": {"menu": {"defaultView": "categories", "mobileDishCard": "vertical", "tagDisplayMode": "both", "dishDescriptionMode": "below"}, "gallery": {"galleryIds": []}, "delivery": {"showMap": false, "descriptionMode": "auto"}}, "sectionsOrder": ["categoryBar", "banners", "menu", "reviews", "delivery"]}	{"hero": {"text": null, "bgUrl": null}, "logo": null, "about": {"text": "", "coverUrl": null}, "delivery": {"manualText": ""}}	₽	services	{"robots": "index", "favicon": null, "ogImage": null, "metaTitle": null, "metaDescription": null, "yandexMetrikaId": null, "googleAnalyticsId": null}	{"addons": false, "combos": false, "dineIn": false, "pickup": false, "kitchen": false, "branches": false, "delivery": false, "services": true, "customers": true, "modifiers": false, "promotions": false, "customRoles": false, "reservations": false}	0	15	{}	\N	{"days": {"1": {"open": "10:15", "close": "23:00"}, "2": {"open": "10:15", "close": "23:00"}, "3": {"open": "10:15", "close": "23:00"}, "4": {"open": "10:15", "close": "23:00"}, "5": {"open": "10:15", "close": "23:00"}, "6": {"open": "10:15", "close": "23:00"}, "7": {"open": "10:15", "close": "23:00"}}, "default": {"open": "10:15", "close": "23:00"}}	t	Europe/Moscow	\N	zones	0	{}	{"inn": "1234567890", "ogrn": "1234567890123", "legalName": "йцу", "legalAddress": "йкцуцк", "privacyEmail": "evgeniy.nevesenko@gmail.com"}	food	f	{"completed_at": null, "dismissed_at": null, "current_step_id": "intake-services"}	{cash,card}	per_branch	{}	m
\.

-- public.tenant_roles
COPY public.tenant_roles (id,tenant_id,name,permissions,is_default,created_at,updated_at) FROM stdin;
b64eb5c4-cf3a-46c8-832e-58e0859a9f30	00000000-0000-0000-0000-000000000002	Администратор	{"menu.edit": true, "menu.view": true, "team.view": true, "menu.delete": true, "orders.edit": true, "orders.view": true, "promos.view": true, "tables.view": true, "team.manage": true, "content.edit": true, "content.view": true, "kitchen.view": true, "roles.manage": true, "orders.cancel": true, "orders.create": true, "orders.status": true, "promos.manage": true, "settings.edit": true, "settings.view": true, "tables.manage": true, "analytics.view": true, "reservations.view": true, "reservations.manage": true, "appointments.view_all": true}	t	2026-03-30 14:26:55.095188+00	2026-03-30 14:26:55.095188+00
46cceef7-ab78-4b2b-8444-13727fdf451c	00000000-0000-0000-0000-000000000002	Менеджер зала	{"menu.view": true, "orders.edit": true, "orders.view": true, "tables.view": true, "kitchen.view": true, "orders.cancel": true, "orders.create": true, "orders.status": true, "tables.manage": true, "reservations.view": true, "reservations.manage": true}	t	2026-03-30 14:26:55.095188+00	2026-03-30 14:26:55.095188+00
0f29fb11-8a1e-49f2-bccd-926afc35d95f	00000000-0000-0000-0000-000000000002	Кассир	{"menu.view": true, "orders.edit": true, "orders.view": true, "orders.create": true, "orders.status": true}	t	2026-03-30 14:26:55.095188+00	2026-03-30 14:26:55.095188+00
ba28312e-3826-4cdc-996f-e47c8538347c	00000000-0000-0000-0000-000000000002	Повар	{"menu.view": true, "kitchen.view": true}	t	2026-03-30 14:26:55.095188+00	2026-03-30 14:26:55.095188+00
5ae16485-dcdb-4134-bcfd-760f17b16144	00000000-0000-0000-0000-000000000002	Хостес	{"orders.view": true, "tables.view": true, "reservations.view": true, "reservations.manage": true}	t	2026-03-30 14:26:55.095188+00	2026-03-30 14:26:55.095188+00
c1e06850-52de-4026-acc0-8afd90a57168	00000000-0000-0000-0000-000000000002	Контент-менеджер	{"menu.edit": true, "menu.view": true, "menu.delete": true, "promos.view": true, "content.edit": true, "content.view": true, "promos.manage": true}	t	2026-03-30 14:26:55.095188+00	2026-03-30 14:26:55.095188+00
9b5586f4-cc47-4082-b585-567be4659523	00000000-0000-0000-0000-000000000002	Сотрудник	{"menu.view": true, "orders.edit": true, "orders.view": true, "tables.view": true, "kitchen.view": true, "orders.create": true, "orders.status": true, "reservations.view": true, "appointments.view_own": true}	t	2026-04-14 09:27:45.36337+00	2026-04-14 09:27:45.36337+00
c4d7838a-43c5-48a9-b58f-ccb94dfc7de0	b1000000-0000-0000-0000-000000000005	Администратор	{"menu.edit": true, "menu.view": true, "team.view": true, "menu.delete": true, "orders.edit": true, "orders.view": true, "promos.view": true, "tables.view": true, "team.manage": true, "content.edit": true, "content.view": true, "kitchen.view": true, "roles.manage": true, "orders.cancel": true, "orders.create": true, "orders.status": true, "promos.manage": true, "settings.edit": true, "settings.view": true, "tables.manage": true, "analytics.view": true, "reservations.view": true, "reservations.manage": true, "appointments.view_all": true}	t	2026-04-22 10:49:28.555689+00	2026-04-22 10:49:28.555689+00
89ab904b-1cc5-4a2b-b5ac-e20512f66523	b1000000-0000-0000-0000-000000000005	Менеджер	{"menu.edit": true, "menu.view": true, "team.view": true, "menu.delete": true, "orders.edit": true, "orders.view": true, "promos.view": true, "tables.view": true, "content.edit": true, "content.view": true, "kitchen.view": true, "orders.cancel": true, "orders.create": true, "orders.status": true, "promos.manage": true, "settings.view": true, "tables.manage": true, "analytics.view": true, "reservations.view": true, "reservations.manage": true, "appointments.view_all": true}	t	2026-04-22 10:49:28.555689+00	2026-04-22 10:49:28.555689+00
0ecdb397-b373-40e5-bfe3-c8ff891d0492	00000000-0000-0000-0000-000000000002	Менеджер	{"menu.edit": true, "menu.view": true, "team.view": true, "menu.delete": true, "orders.edit": true, "orders.view": true, "promos.view": true, "tables.view": true, "content.edit": true, "content.view": true, "kitchen.view": true, "orders.cancel": true, "orders.create": true, "orders.status": true, "promos.manage": true, "settings.view": true, "tables.manage": true, "analytics.view": true, "reservations.view": true, "reservations.manage": true, "appointments.view_all": true}	t	2026-04-14 09:27:45.362049+00	2026-04-14 09:27:45.362049+00
835bae88-b7a3-4899-b68f-fc270f62f979	b1000000-0000-0000-0000-000000000005	Сотрудник	{"menu.view": true, "orders.edit": true, "orders.view": true, "tables.view": true, "kitchen.view": true, "orders.create": true, "orders.status": true, "reservations.view": true, "appointments.view_own": true}	t	2026-04-22 10:49:28.555689+00	2026-04-22 10:49:28.555689+00
\.

-- public.tenant_members
COPY public.tenant_members (id,tenant_id,user_id,created_at,branch_ids,blocked_until,role_id) FROM stdin;
66ef70a0-ecd6-466e-9b0a-57dd3e16a3ca	00000000-0000-0000-0000-000000000002	00000000-0000-0000-0000-000000000001	2026-03-09 11:16:17.054649+00	{}	\N	\N
e62c2431-06d0-4648-956b-c0a21259d75d	b1000000-0000-0000-0000-000000000005	a0fc6305-3212-4ab7-a24c-241eda32dd97	2026-04-22 10:49:28.555689+00	{}	\N	\N
6cce2440-d624-4dd4-ae48-74fea229d574	b1000000-0000-0000-0000-000000000005	7642ed14-e24c-40b0-9d15-d43740acc06d	2026-04-28 05:46:17.588934+00	{4ca87a04-6735-4b6d-a0ae-921c5e5569db}	\N	835bae88-b7a3-4899-b68f-fc270f62f979
d7b1a47e-fe37-4746-b8cb-19b82a34940c	b1000000-0000-0000-0000-000000000005	faf8224b-6b91-4520-89a1-cdf84d278178	2026-04-28 05:46:17.588934+00	{4ca87a04-6735-4b6d-a0ae-921c5e5569db}	\N	835bae88-b7a3-4899-b68f-fc270f62f979
8e034aa7-c31e-45cd-901c-12b7ee7424bb	b1000000-0000-0000-0000-000000000005	94483987-838c-493e-944a-06f3b4e477e7	2026-04-28 05:46:17.588934+00	{4ca87a04-6735-4b6d-a0ae-921c5e5569db}	\N	835bae88-b7a3-4899-b68f-fc270f62f979
67917bf4-d0f5-4125-8d5e-206ab3b9a7ce	b1000000-0000-0000-0000-000000000005	027da995-8596-4ead-a1af-4126257070a5	2026-04-28 05:46:17.588934+00	{4ca87a04-6735-4b6d-a0ae-921c5e5569db}	\N	835bae88-b7a3-4899-b68f-fc270f62f979
\.

-- public.branches
COPY public.branches (id,tenant_id,name,address,phone,is_active,working_hours_schedule,delivery_min_order,delivery_fee,notifications,created_at,updated_at,archived_at,latitude,longitude,color,order_number_prefix,address_data) FROM stdin;
a27dfccb-0eea-48e5-925c-b776415f5abd	00000000-0000-0000-0000-000000000002	Третий	г Барнаул, пр-кт Ленина, д 154	\N	t	\N	\N	\N	\N	2026-03-11 05:24:00.238857+00	2026-05-04 04:53:14.494522+00	2026-03-18 09:10:14.584+00	53.3844009	83.7400703	#795548	\N	{"value": "г Барнаул, пр-кт Ленина, д 154"}
ca634a0d-3848-4c10-800c-28f9fde25160	00000000-0000-0000-0000-000000000002	Балтийский 1	г Барнаул, ул Балтийская, д 65	+7 (909) 090-90-90	t	\N	\N	\N	\N	2026-03-09 12:07:58.227515+00	2026-05-04 04:53:14.494522+00	\N	53.3351016	83.6728576	#00C853	\N	{"value": "г Барнаул, ул Балтийская, д 65"}
6ee36e3b-0eaf-4ec3-bb09-5890616612db	00000000-0000-0000-0000-000000000002	Первый	г Барнаул, ул 280-летия Барнаула, д 2	+7 (999) 999-99-99	t	\N	\N	\N	\N	2026-03-10 09:03:45.886255+00	2026-05-04 04:53:14.494522+00	\N	53.3479778	83.6692687	#E91E63	\N	{"value": "г Барнаул, ул 280-летия Барнаула, д 2"}
4ca87a04-6735-4b6d-a0ae-921c5e5569db	b1000000-0000-0000-0000-000000000005	уцк	Воронежская обл, г Лиски, пер Ленина 1-й	\N	t	\N	\N	\N	\N	2026-04-27 11:22:35.788132+00	2026-05-04 04:53:14.494522+00	\N	50.9740318	39.5071991	#6366f1	\N	{"value": "Воронежская обл, г Лиски, пер Ленина 1-й"}
\.

-- public.tables
COPY public.tables (id,tenant_id,name,is_open,is_active,created_at,opened_at,capacity,tags,position_x,position_y,shape,table_width,table_height,notes,rotation,color,branch_id) FROM stdin;
8a45e69b-d70d-4e36-8bb5-fb4e2b97f0cb	00000000-0000-0000-0000-000000000002	Стол 1	f	f	2026-03-18 11:38:48.823884+00	2026-05-30 06:26:59.912652+00	8	{}	37.890625	29.55859375	rectangle	200	80	\N	0	#C4A84F	ca634a0d-3848-4c10-800c-28f9fde25160
aa590d0f-921b-4afc-9402-b672488968b8	00000000-0000-0000-0000-000000000002	длоцуатлдцуота	t	t	2026-03-18 11:54:12.075894+00	2026-05-30 06:51:50.46+00	12	{}	619.5489988129566	247.45052597205165	rectangle	113.70703125	60	цукцук	0	\N	ca634a0d-3848-4c10-800c-28f9fde25160
afe04b48-2804-482b-9129-7c078a42f971	00000000-0000-0000-0000-000000000002	Стол 11	f	t	2026-03-31 07:16:50.606587+00	\N	\N	{}	74.5091136439438	503.165585701719	rectangle	120	80	\N	0	\N	ca634a0d-3848-4c10-800c-28f9fde25160
a71c16d5-5140-4dbf-840c-74ef55160512	00000000-0000-0000-0000-000000000002	Стол 6	t	t	2026-03-18 11:53:19.742904+00	2026-05-30 07:13:16.38+00	12	{}	703.9826570910909	64.54098458885125	rectangle	120	80	\N	0	#8E6BAA	ca634a0d-3848-4c10-800c-28f9fde25160
943caa00-8264-4f61-8784-b00146ed506e	00000000-0000-0000-0000-000000000002	Стол 2	t	t	2026-03-18 11:41:44.450328+00	2026-04-13 08:02:57.876+00	6	{}	584.625	47.1171875	rectangle	71.31640625	60	\N	0	\N	ca634a0d-3848-4c10-800c-28f9fde25160
56855e8f-88c6-45e5-994a-0fb11c3fb539	00000000-0000-0000-0000-000000000002	Стол 8	f	t	2026-03-18 12:07:03.738954+00	\N	\N	{}	347.7808752190593	259.6018043183573	rectangle	60	60	\N	0	\N	ca634a0d-3848-4c10-800c-28f9fde25160
e56256b9-60a6-4599-a258-7d09615d7336	00000000-0000-0000-0000-000000000002	Стол 12	f	t	2026-04-13 06:11:57.948705+00	\N	\N	{}	848.4550617710904	209.10621217615366	rectangle	120	80	\N	0	\N	ca634a0d-3848-4c10-800c-28f9fde25160
02ae53de-58a1-444c-a7c8-8ac9815e0653	00000000-0000-0000-0000-000000000002	Стол 7	t	t	2026-03-18 11:53:39.803176+00	2026-05-31 03:27:03.863174+00	12	{}	201.99473572767025	357.64507902237193	circle	102.79454785314556	102.79454785314556	\N	0	\N	ca634a0d-3848-4c10-800c-28f9fde25160
83f0d6a0-894a-44a6-a69e-5385b3c33414	00000000-0000-0000-0000-000000000002	Стол 9	f	t	2026-03-31 05:27:06.78243+00	\N	\N	{}	176.12033683868958	243.3572085885595	rectangle	120	80	\N	0	\N	ca634a0d-3848-4c10-800c-28f9fde25160
bc878f9b-ab27-415a-ac5a-00757771be9e	00000000-0000-0000-0000-000000000002	Стол 4	t	t	2026-03-18 11:45:18.611185+00	2026-05-31 03:27:03.863174+00	10	{}	7.279296875	170.60061966719456	rectangle	102.09765625	175.00390625	\N	0	#72A67A	ca634a0d-3848-4c10-800c-28f9fde25160
8049ed3d-3f4e-4f2a-a6cd-5aa39aa1b455	00000000-0000-0000-0000-000000000002	Стол 5	t	t	2026-03-18 11:47:31.921535+00	2026-05-31 03:27:03.863174+00	2	{}	351.10527115888726	47.45676288158012	rectangle	123.61328125	123.61328125	\N	0	\N	ca634a0d-3848-4c10-800c-28f9fde25160
2348f389-2c0e-4e64-8ab2-4fc8a6fb382e	00000000-0000-0000-0000-000000000002	Стол 10	f	t	2026-03-31 06:47:28.696149+00	\N	1	{}	179.4586591586393	62.70012975925893	rectangle	120	80	\N	0	\N	ca634a0d-3848-4c10-800c-28f9fde25160
28f9c2bb-8761-4b53-b430-470410bb836a	00000000-0000-0000-0000-000000000002	уцкуц	f	f	2026-03-18 10:48:22.71541+00	2026-03-18 11:05:05.289+00	\N	{}	416.65234375	210.16796875	rectangle	120	80	\N	0	\N	ca634a0d-3848-4c10-800c-28f9fde25160
a1b2c30c-6757-4977-b60a-3d1d0b76485c	00000000-0000-0000-0000-000000000002	Стол 10	f	t	2026-03-31 05:56:18.662865+00	\N	\N	{}	446.01623946865243	194.41956931778185	rectangle	120	80	\N	0	\N	ca634a0d-3848-4c10-800c-28f9fde25160
\.

-- public.table_call_types
COPY public.table_call_types (id,tenant_id,name,sort_order,created_at) FROM stdin;
\.

-- public.schedule_templates
COPY public.schedule_templates (id,tenant_id,name,type,cycle_length,reference_branch_id,created_at,updated_at,sort_order) FROM stdin;
7bbbed2c-b572-447b-82b2-f85e5d52f2b0	b1000000-0000-0000-0000-000000000005	754	weekly	\N	\N	2026-04-28 07:12:22.779446+00	2026-04-28 07:12:22.779446+00	0
31705c5d-1916-44ef-9670-98c080d66b23	b1000000-0000-0000-0000-000000000005	3к32к2	shift	4	\N	2026-04-28 08:48:24.959166+00	2026-04-29 06:40:51.909223+00	0
\.

-- public.dish_tags
COPY public.dish_tags (id,tenant_id,name,icon,color,sort_order,created_at) FROM stdin;
c0d8c20c-6fb2-41cf-8546-844c299a04d4	00000000-0000-0000-0000-000000000002	Хит	Zap	blue	0	2026-03-26 11:44:58.88915+00
9393c261-8301-4dd0-a42c-45caf67f3654	00000000-0000-0000-0000-000000000002	Популярное	Star	amber	0	2026-03-26 11:44:58.88915+00
d882d57a-c60b-4aee-8eaa-0b81c8b64b3a	00000000-0000-0000-0000-000000000002	Острое	Flame	red	0	2026-03-26 11:44:58.88915+00
6416d47f-332b-49d2-9531-03af328ef6b9	00000000-0000-0000-0000-000000000002	Веган	Leaf	green	0	2026-03-26 11:44:58.88915+00
68676f53-5192-4d58-a6e9-9e60c032b2b4	00000000-0000-0000-0000-000000000002	Для детей	Lollipop	cyan	1	2026-04-09 11:59:04.657696+00
38d25fda-36f4-4a76-80db-26851d799872	00000000-0000-0000-0000-000000000002	Акция	Percent	rose	2	2026-04-09 11:59:29.218186+00
\.

-- public.categories
COPY public.categories (id,tenant_id,name,sort_order,active,created_at,updated_at,photo_url,use_first_dish_photo,deleted_at,type,tag_id,slug,kind,color) FROM stdin;
a6db139f-0bdc-4b88-973e-71cd9b56a2bc	b1000000-0000-0000-0000-000000000005	цйуйц	0	t	2026-04-27 11:23:51.165015+00	2026-04-27 11:23:51.165015+00	\N	f	\N	regular	\N	ciuic	food	\N
c52e851b-1092-4932-9cdb-bd2640364117	b1000000-0000-0000-0000-000000000005	Стрижка	0	t	2026-04-28 03:29:30.146984+00	2026-04-28 03:29:30.146984+00	\N	f	\N	regular	\N	strizhka	service	\N
45f73150-38fa-4757-ae90-c56deac59987	b1000000-0000-0000-0000-000000000005	Массаж	0	t	2026-05-03 10:42:25.46603+00	2026-05-03 10:42:25.46603+00	\N	f	\N	regular	\N	massazh	service	\N
7c08020a-efdc-4f71-a6a6-cb0d74533603	00000000-0000-0000-0000-000000000002	Новая категория	6	t	2026-03-26 12:50:37.980372+00	2026-03-26 12:50:41.377309+00	\N	f	2026-03-26 12:50:41.358+00	regular	\N	\N	food	\N
16a848ac-d4cf-4fc8-9bed-807709e4b901	00000000-0000-0000-0000-000000000002	уцацуац	5	t	2026-03-11 15:40:30.468053+00	2026-03-13 11:18:22.131312+00	\N	f	2026-03-13 11:18:22.075+00	regular	\N	\N	food	\N
4f0b9e09-e79a-407e-b22d-969eb582db7e	00000000-0000-0000-0000-000000000002	йцукуцк	9	t	2026-03-13 11:05:48.340185+00	2026-03-13 11:18:23.897127+00	\N	f	2026-03-13 11:18:23.873+00	regular	\N	\N	food	\N
f0ea6d7b-044a-4028-8832-2498d34c077b	00000000-0000-0000-0000-000000000002	тььтьт	7	t	2026-03-13 06:48:06.542539+00	2026-03-13 11:18:25.883852+00	\N	f	2026-03-13 11:18:25.872+00	regular	\N	\N	food	\N
00000000-0000-0000-0002-000000000001	00000000-0000-0000-0000-000000000002	Пицца	3	t	2026-03-09 11:16:17.055405+00	2026-03-26 12:51:13.962997+00	http://127.0.0.1:54321/storage/v1/object/public/dish-images/00000000-0000-0000-0000-000000000002/204e9592-a1ac-48bd-9b63-6d45f04be865.webp	f	\N	regular	\N	\N	food	\N
d4fe189c-134f-49e4-b939-e8910771b191	00000000-0000-0000-0000-000000000002	Новая категория	7	t	2026-03-26 12:29:00.776796+00	2026-03-26 12:29:04.690862+00	\N	f	2026-03-26 12:29:04.671+00	regular	\N	\N	food	\N
6bb5d272-4c7c-4155-9143-fbc70e39362a	00000000-0000-0000-0000-000000000002	Новинки	1	t	2026-03-13 05:42:33.643515+00	2026-03-26 12:38:01.875888+00	\N	f	2026-03-26 12:38:01.852+00	regular	\N	\N	food	\N
00000000-0000-0000-0002-000000000004	00000000-0000-0000-0000-000000000002	Напитки	6	t	2026-03-09 11:16:17.055405+00	2026-03-26 12:51:13.972099+00	\N	f	\N	regular	\N	\N	food	\N
00000000-0000-0000-0002-000000000003	00000000-0000-0000-0000-000000000002	Закуски	5	t	2026-03-09 11:16:17.055405+00	2026-03-26 12:51:13.977698+00	\N	f	\N	regular	\N	\N	food	\N
00000000-0000-0000-0002-000000000002	00000000-0000-0000-0000-000000000002	Бургеры	4	t	2026-03-09 11:16:17.055405+00	2026-03-26 12:51:13.977426+00	\N	f	\N	regular	\N	\N	food	\N
36b80a58-40ca-4d9d-9355-330d3acd7bca	00000000-0000-0000-0000-000000000002	цйу	0	t	2026-03-26 14:30:10.304921+00	2026-03-27 01:30:20.226309+00	\N	f	2026-03-27 01:30:20.205+00	regular	9393c261-8301-4dd0-a42c-45caf67f3654	\N	food	\N
6e084d6a-6f7e-4641-b5f6-65646b71b584	00000000-0000-0000-0000-000000000002	Комбо	0	t	2026-03-13 05:40:17.268377+00	2026-03-27 01:32:16.878026+00	\N	f	\N	combo	\N	\N	food	\N
4c94a201-c425-4ed6-8ea0-c0cf809b5fdc	00000000-0000-0000-0000-000000000002	Распродажа	2	f	2026-03-26 12:51:10.713321+00	2026-03-27 01:34:15.520356+00	\N	f	\N	regular	c0d8c20c-6fb2-41cf-8546-844c299a04d4	\N	food	\N
4248fa00-2f39-4791-935d-3822d5ee9460	00000000-0000-0000-0000-000000000002	Детское меню	0	t	2026-04-09 12:04:19.036106+00	2026-04-09 12:04:19.036106+00	\N	f	\N	regular	68676f53-5192-4d58-a6e9-9e60c032b2b4	\N	food	\N
\.

-- public.dishes
COPY public.dishes (id,tenant_id,category_id,name,description,price,photos,ingredients,nutrition,active,sort_order,created_at,updated_at,deleted_at,requires_kitchen,weight_unit,max_addons,long_description) FROM stdin;
00000000-0000-0000-0005-000000000007	00000000-0000-0000-0000-000000000002	00000000-0000-0000-0002-000000000003	Картофель фри	Хрустящий картофель фри, жаренный в рафинированном масле. Подаётся с кетчупом.	180.00	{}	[]	{"fat": 18, "carbs": 52, "weight": 200, "protein": 5, "calories": 380}	t	1	2026-03-09 11:16:17.056434+00	2026-04-09 11:17:49.676471+00	2026-04-09 11:17:49.667+00	t	г	\N	\N
00000000-0000-0000-0005-000000000005	00000000-0000-0000-0000-000000000002	00000000-0000-0000-0002-000000000002	Барбекю Бургер	Говяжья котлета 200г, хрустящий бекон, карамелизированный лук, соус BBQ.	450.00	{}	[]	{"fat": 38, "carbs": 60, "weight": 350, "protein": 34, "calories": 720}	t	2	2026-03-09 11:16:17.056434+00	2026-03-27 05:50:23.014623+00	\N	t	г	\N	\N
00000000-0000-0000-0005-000000000008	00000000-0000-0000-0000-000000000002	00000000-0000-0000-0002-000000000003	Куриные стрипсы	5 кусочков куриного филе в хрустящей панировке. Фирменный соус в комплекте.	280.00	{}	[]	{"fat": 22, "carbs": 32, "weight": 180, "protein": 24, "calories": 420}	t	2	2026-03-09 11:16:17.056434+00	2026-03-27 05:50:23.014623+00	\N	t	г	\N	\N
00000000-0000-0000-0005-000000000004	00000000-0000-0000-0000-000000000002	00000000-0000-0000-0002-000000000002	Классик Бургер	Говяжья котлета 180г, листья салата, томат, маринованный огурец, соус бургер.	380.00	{}	[]	{"fat": 32, "carbs": 55, "weight": 320, "protein": 28, "calories": 620}	t	1	2026-03-09 11:16:17.056434+00	2026-03-27 05:50:23.014623+00	\N	t	г	\N	\N
00000000-0000-0000-0005-000000000006	00000000-0000-0000-0000-000000000002	00000000-0000-0000-0002-000000000002	Чикен Бургер	Куриная котлета в панировке, хрустящий салат, маринованные джалапеньо, майонез.	360.00	{}	[]	{"fat": 24, "carbs": 58, "weight": 290, "protein": 26, "calories": 560}	t	3	2026-03-09 11:16:17.056434+00	2026-03-27 05:50:23.014623+00	\N	t	г	\N	\N
89b81b1d-355c-4ffd-8979-afd64130c4d8	00000000-0000-0000-0000-000000000002	00000000-0000-0000-0002-000000000004	Кофе 		199.00	{}	[]	{"fat": 0, "carbs": 0, "weight": 300, "protein": 0, "calories": 0}	t	3	2026-03-27 05:55:07.875686+00	2026-03-27 05:55:07.875686+00	\N	t	мл	\N	\N
00000000-0000-0000-0005-000000000001	00000000-0000-0000-0000-000000000002	00000000-0000-0000-0002-000000000001	Маргарита	Томатный соус, моцарелла, свежий базилик. Классика, которая никогда не надоедает.	590.00	{http://127.0.0.1:54321/storage/v1/object/public/dish-images/00000000-0000-0000-0000-000000000002/9aaffef2-29b2-4391-a912-a131582a5e01.webp}	[]	{"fat": 0, "carbs": 0, "weight": 300, "protein": 0, "calories": 0}	t	1	2026-03-09 11:16:17.056434+00	2026-04-09 12:14:22.106148+00	\N	t	г	\N	\N
00000000-0000-0000-0005-000000000002	00000000-0000-0000-0000-000000000002	00000000-0000-0000-0002-000000000001	Пепперони	Томатный соус, моцарелла, острая пепперони. Для тех, кто любит поострее.	690.00	{http://127.0.0.1:54321/storage/v1/object/public/dish-images/00000000-0000-0000-0000-000000000002/f08994ef-2424-45be-a394-94a0d917867f.webp}	[{"name": "йцуйцу"}, {"name": "уцйуцйуц"}]	{"fat": 0, "carbs": 0, "weight": 300, "protein": 0, "calories": 0}	t	0	2026-03-09 11:16:17.056434+00	2026-04-12 11:41:48.339948+00	\N	t	г	1	\N
00000000-0000-0000-0005-000000000010	00000000-0000-0000-0000-000000000002	00000000-0000-0000-0002-000000000004	Кока-Кола 0.5л	Классическая Coca-Cola в охлаждённом виде.	120.00	{}	[]	{"fat": 0, "carbs": 0, "weight": 500, "protein": 0, "calories": 0}	t	1	2026-03-09 11:16:17.056434+00	2026-04-10 02:34:14.589817+00	\N	t	г	\N	\N
00000000-0000-0000-0005-000000000011	00000000-0000-0000-0000-000000000002	00000000-0000-0000-0002-000000000004	Лимонад Домашний	Свежевыжатый лимон, мята, имбирь и газированная вода. Освежает мгновенно.	180.00	{}	[]	{"fat": 0, "carbs": 0, "weight": 400, "protein": 0, "calories": 0}	t	1	2026-03-09 11:16:17.056434+00	2026-04-01 07:54:04.897431+00	\N	f	г	\N	\N
00000000-0000-0000-0005-000000000003	00000000-0000-0000-0000-000000000002	00000000-0000-0000-0002-000000000001	Четыре сыра	Моцарелла, пармезан, горгонзола, чеддер. Сырный рай для настоящих гурманов.	650.00	{}	[]	{"fat": 0, "carbs": 0, "weight": 430, "protein": 0, "calories": 0}	t	2	2026-03-09 11:16:17.056434+00	2026-04-08 05:52:39.091568+00	\N	t	г	\N	\N
00000000-0000-0000-0005-000000000012	00000000-0000-0000-0000-000000000002	00000000-0000-0000-0002-000000000004	Молочный коктейль	Густой молочный коктейль на выбор: ваниль, шоколад или клубника.	220.00	{}	[]	{"fat": 0, "carbs": 0, "weight": 350, "protein": 0, "calories": 0}	t	2	2026-03-09 11:16:17.056434+00	2026-04-10 09:43:01.42962+00	\N	f	г	\N	\N
00000000-0000-0000-0005-000000000009	00000000-0000-0000-0000-000000000002	00000000-0000-0000-0002-000000000003	Луковые кольца	Сладкий лук в воздушном кляре, обжаренный до золотистой корочки.	220.00	{}	[{"name": "печень"}, {"name": ""}]	{"fat": 0, "carbs": 0, "weight": 160, "protein": 0, "calories": 0}	t	0	2026-03-09 11:16:17.056434+00	2026-04-12 05:07:36.207695+00	\N	f	г	\N	\N
6ab124f4-543b-4553-b484-7714d85abfdd	00000000-0000-0000-0000-000000000002	00000000-0000-0000-0002-000000000001	E2E Test Dish 1779114858293		199.00	{}	[]	\N	t	6	2026-05-18 14:34:18.728671+00	2026-05-18 14:34:18.728671+00	\N	t	г	\N	\N
da84fd0c-b2bc-4f2c-8e95-b4d4d5ce9bdd	00000000-0000-0000-0000-000000000002	00000000-0000-0000-0002-000000000001	E2E Test Dish 1779114916445		199.00	{}	[]	\N	t	7	2026-05-18 14:35:16.879369+00	2026-05-18 14:35:16.879369+00	\N	t	г	\N	\N
b77aab4b-8de1-4b4a-8f15-d4e3696f4ef2	00000000-0000-0000-0000-000000000002	00000000-0000-0000-0002-000000000001	E2E Test Dish 1779116623332		199.00	{}	[]	\N	t	8	2026-05-18 15:03:43.782831+00	2026-05-18 15:03:43.782831+00	\N	t	г	\N	\N
34bfcac0-9ef4-4cb7-b4d6-71f49214f1dd	00000000-0000-0000-0000-000000000002	00000000-0000-0000-0002-000000000001	E2E Test Dish 1779156130443		199.00	{}	[]	\N	t	9	2026-05-19 02:02:10.860039+00	2026-05-19 02:02:10.860039+00	\N	t	г	\N	\N
d57afff7-5121-44bc-b1c0-22c11343aed2	00000000-0000-0000-0000-000000000002	00000000-0000-0000-0002-000000000001	E2E Test Dish 1780233191349		199.00	{}	[]	\N	t	10	2026-05-31 13:13:11.808726+00	2026-05-31 13:13:11.808726+00	\N	t	г	\N	\N
989ce660-927d-4adf-babe-38a7fdc1cd57	b1000000-0000-0000-0000-000000000005	a6db139f-0bdc-4b88-973e-71cd9b56a2bc	йцуцйуцйу		123.00	{}	[]	\N	t	0	2026-04-27 11:24:05.930142+00	2026-04-28 01:47:27.224512+00	\N	t	г	\N	\N
784776ec-feae-4569-b92f-ef999443c4d7	00000000-0000-0000-0000-000000000002	00000000-0000-0000-0002-000000000001	E2E Test Dish 1779114488187		199.00	{}	[]	\N	t	3	2026-05-18 14:28:08.609603+00	2026-05-18 14:28:08.609603+00	\N	t	г	\N	\N
bdbd2d38-5c67-449f-b8a8-be15811adf36	00000000-0000-0000-0000-000000000002	00000000-0000-0000-0002-000000000001	E2E Test Dish 1779114498361		199.00	{}	[]	\N	t	4	2026-05-18 14:28:18.814213+00	2026-05-18 14:28:18.814213+00	\N	t	г	\N	\N
4f22f6bc-05ec-4637-b8df-d1678f9c4b3f	00000000-0000-0000-0000-000000000002	00000000-0000-0000-0002-000000000001	E2E Test Dish 1779114748706		199.00	{}	[]	\N	t	5	2026-05-18 14:32:29.126703+00	2026-05-18 14:32:29.126703+00	\N	t	г	\N	\N
\.

-- public.dish_tag_assignments
COPY public.dish_tag_assignments (dish_id,tag_id,tenant_id,sort_order) FROM stdin;
00000000-0000-0000-0005-000000000004	9393c261-8301-4dd0-a42c-45caf67f3654	00000000-0000-0000-0000-000000000002	0
00000000-0000-0000-0005-000000000005	c0d8c20c-6fb2-41cf-8546-844c299a04d4	00000000-0000-0000-0000-000000000002	1
00000000-0000-0000-0005-000000000006	d882d57a-c60b-4aee-8eaa-0b81c8b64b3a	00000000-0000-0000-0000-000000000002	0
00000000-0000-0000-0005-000000000007	9393c261-8301-4dd0-a42c-45caf67f3654	00000000-0000-0000-0000-000000000002	0
00000000-0000-0000-0005-000000000008	9393c261-8301-4dd0-a42c-45caf67f3654	00000000-0000-0000-0000-000000000002	0
00000000-0000-0000-0005-000000000011	6416d47f-332b-49d2-9531-03af328ef6b9	00000000-0000-0000-0000-000000000002	0
00000000-0000-0000-0005-000000000003	c0d8c20c-6fb2-41cf-8546-844c299a04d4	00000000-0000-0000-0000-000000000002	0
00000000-0000-0000-0005-000000000002	9393c261-8301-4dd0-a42c-45caf67f3654	00000000-0000-0000-0000-000000000002	0
00000000-0000-0000-0005-000000000002	d882d57a-c60b-4aee-8eaa-0b81c8b64b3a	00000000-0000-0000-0000-000000000002	0
89b81b1d-355c-4ffd-8979-afd64130c4d8	9393c261-8301-4dd0-a42c-45caf67f3654	00000000-0000-0000-0000-000000000002	0
00000000-0000-0000-0005-000000000003	9393c261-8301-4dd0-a42c-45caf67f3654	00000000-0000-0000-0000-000000000002	0
00000000-0000-0000-0005-000000000012	68676f53-5192-4d58-a6e9-9e60c032b2b4	00000000-0000-0000-0000-000000000002	0
00000000-0000-0000-0005-000000000012	38d25fda-36f4-4a76-80db-26851d799872	00000000-0000-0000-0000-000000000002	0
00000000-0000-0000-0005-000000000012	6416d47f-332b-49d2-9531-03af328ef6b9	00000000-0000-0000-0000-000000000002	0
\.

-- public.modifier_groups
COPY public.modifier_groups (id,tenant_id,name,sort_order,active,deleted_at,created_at,affects_weight,weight_mode) FROM stdin;
00000000-0000-0000-0003-000000000001	00000000-0000-0000-0000-000000000002	Размер	0	f	2026-04-09 10:52:39.485+00	2026-03-09 11:16:17.055702+00	t	per_dish
e5f71693-e661-4d25-a03f-ffd6ec32d59a	00000000-0000-0000-0000-000000000002	Диаметр	0	t	\N	2026-04-09 11:26:34.803613+00	t	global
\.

-- public.addons
COPY public.addons (id,tenant_id,name,weight,price,photo,active,sort_order,deleted_at) FROM stdin;
73b556ed-78c4-4091-9a72-945aa452dfb9	00000000-0000-0000-0000-000000000002	уцауца	\N	234	\N	t	0	\N
c436ea6b-c5db-40f4-a28b-21c1f3e7d280	00000000-0000-0000-0000-000000000002	йцуцйуйцуцй	\N	34	\N	f	0	2026-04-09 10:39:47.343+00
\.

-- public.addon_presets
COPY public.addon_presets (id,tenant_id,name,active,deleted_at) FROM stdin;
988ee64b-65eb-497f-a2fc-b78a6f1470e4	00000000-0000-0000-0000-000000000002	щцоуап	t	\N
c763bb0c-38ea-43cc-b2f7-7364477263d6	00000000-0000-0000-0000-000000000002	12334	t	\N
b1cec433-14aa-415d-9645-e07982514e96	00000000-0000-0000-0000-000000000002	йцу	t	\N
\.

-- public.combos
COPY public.combos (id,tenant_id,category_id,name,description,price,photos,active,sort_order,created_at) FROM stdin;
e896dfdc-377b-4df5-80d0-0646b5e0d815	00000000-0000-0000-0000-000000000002	6e084d6a-6f7e-4641-b5f6-65646b71b584	Комбо 1		1200	{}	t	0	2026-03-13 05:59:01.937728+00
\.

-- public.services
COPY public.services (id,tenant_id,category_id,name,description,price,duration,photos,tags,is_bookable,active,sort_order,created_at,updated_at,booking_mode,allow_resource_choice,max_duration,long_description) FROM stdin;
ad6b9c23-c3e1-4167-9230-51ff1c92260c	b1000000-0000-0000-0000-000000000005	c52e851b-1092-4932-9cdb-bd2640364117	Стрижка налысо		200	30	{}	{}	t	t	0	2026-04-28 12:26:20.295976+00	2026-05-03 09:10:24.458214+00	fixed	t	\N	\N
5734e6c8-ba04-4cfa-968b-c356152b385d	b1000000-0000-0000-0000-000000000005	c52e851b-1092-4932-9cdb-bd2640364117	Стрижка обычная	дцулаорцуа цущшар уцщшар ущцша\nуца\nуца	400	60	{}	{}	t	t	0	2026-04-28 03:29:54.018723+00	2026-05-03 10:33:29.648542+00	fixed	t	\N	\N
c7ba529a-be2e-4a5d-971a-5366f2f8c4c0	b1000000-0000-0000-0000-000000000005	45f73150-38fa-4757-ae90-c56deac59987	Массаж обычный		1000	60	{}	{}	t	t	0	2026-05-03 10:42:55.446919+00	2026-05-03 10:42:55.446919+00	fixed	t	\N	\N
\.

-- public.resources
COPY public.resources (id,tenant_id,member_id,name,is_active,sort_order,created_at,type,updated_at,capacity,applied_template_id,cycle_start_date) FROM stdin;
a09fabbc-dd69-45bb-8085-86d0a337a45a	b1000000-0000-0000-0000-000000000005	\N	Зона 1	t	0	2026-04-28 00:57:23.236069+00	object	2026-04-28 00:57:23.236069+00	1	\N	\N
60fabd8e-0b74-4a43-a906-bd577f9e8927	b1000000-0000-0000-0000-000000000005	6cce2440-d624-4dd4-ae48-74fea229d574	Анна Петрова	t	1	2026-04-28 07:04:21.182975+00	person	2026-04-29 04:56:45.015607+00	1	\N	\N
70f8e1f1-4022-4d03-844c-68763f434880	b1000000-0000-0000-0000-000000000005	d7b1a47e-fe37-4746-b8cb-19b82a34940c	Дмитрий Сидоров	t	0	2026-04-28 07:18:45.347792+00	person	2026-04-29 06:34:13.22408+00	1	31705c5d-1916-44ef-9670-98c080d66b23	2026-04-27
cc578e37-187d-498c-9a5a-51d2a1dbefcb	b1000000-0000-0000-0000-000000000005	8e034aa7-c31e-45cd-901c-12b7ee7424bb	Елена Козлова	t	0	2026-05-03 13:20:46.979593+00	person	2026-05-03 13:20:46.979593+00	1	\N	\N
\.

-- public.resource_branches
COPY public.resource_branches (resource_id,branch_id) FROM stdin;
60fabd8e-0b74-4a43-a906-bd577f9e8927	4ca87a04-6735-4b6d-a0ae-921c5e5569db
70f8e1f1-4022-4d03-844c-68763f434880	4ca87a04-6735-4b6d-a0ae-921c5e5569db
cc578e37-187d-498c-9a5a-51d2a1dbefcb	4ca87a04-6735-4b6d-a0ae-921c5e5569db
\.

-- public.resource_categories
COPY public.resource_categories (resource_id,category_id) FROM stdin;
70f8e1f1-4022-4d03-844c-68763f434880	c52e851b-1092-4932-9cdb-bd2640364117
\.

-- public.resource_schedules
COPY public.resource_schedules (id,resource_id,day_of_week,is_working,open_time,close_time) FROM stdin;
26aee151-d4f9-4ab2-b07d-473aba46f8a3	a09fabbc-dd69-45bb-8085-86d0a337a45a	1	t	09:00:00	18:00:00
6f7e247f-4a59-463f-9ef1-da8bd479a90b	a09fabbc-dd69-45bb-8085-86d0a337a45a	2	t	09:00:00	18:00:00
00b4af15-5ce1-4e9c-8f6f-b60741f086af	a09fabbc-dd69-45bb-8085-86d0a337a45a	3	t	09:00:00	18:00:00
686a144c-a399-4acc-b5f4-de79f89b7ca2	a09fabbc-dd69-45bb-8085-86d0a337a45a	4	t	09:00:00	18:00:00
4e7ac073-a050-4117-be4a-3f988ad8b9d2	cc578e37-187d-498c-9a5a-51d2a1dbefcb	0	t	09:00:00	21:00:00
0c457ee6-6da0-479f-9fa6-4aee55bf6d9e	60fabd8e-0b74-4a43-a906-bd577f9e8927	0	t	09:00:00	21:00:00
162faa5a-3323-42f4-9acd-e09dc099e504	cc578e37-187d-498c-9a5a-51d2a1dbefcb	1	t	09:00:00	21:00:00
33c68829-91b2-4ca3-aa90-64f19956f027	60fabd8e-0b74-4a43-a906-bd577f9e8927	1	t	09:00:00	21:00:00
2d1dd823-67f5-4d86-a19a-1fc3502e959b	cc578e37-187d-498c-9a5a-51d2a1dbefcb	2	t	09:00:00	21:00:00
93bc5e39-b6ba-49ba-8d33-36dd8966e153	60fabd8e-0b74-4a43-a906-bd577f9e8927	2	t	09:00:00	21:00:00
dbff3ff7-340e-47fc-af75-d8e1b70404a6	cc578e37-187d-498c-9a5a-51d2a1dbefcb	3	t	09:00:00	21:00:00
319a4c0f-fed3-4083-abf8-3ccb02730cb2	60fabd8e-0b74-4a43-a906-bd577f9e8927	3	t	09:00:00	21:00:00
489ebcec-a8ca-48eb-806c-ee74f256d8a0	cc578e37-187d-498c-9a5a-51d2a1dbefcb	4	t	09:00:00	21:00:00
62b21df5-a995-465c-b374-4e1aeeb33546	60fabd8e-0b74-4a43-a906-bd577f9e8927	4	t	09:00:00	21:00:00
faf6a2be-4325-40a1-a454-01dfe52538c9	cc578e37-187d-498c-9a5a-51d2a1dbefcb	5	t	09:00:00	21:00:00
a39e27a0-ddda-4187-a47b-4798c7bd9c5a	60fabd8e-0b74-4a43-a906-bd577f9e8927	5	t	09:00:00	21:00:00
66ea8b5a-8102-4978-88e7-fb714714bc71	cc578e37-187d-498c-9a5a-51d2a1dbefcb	6	t	09:00:00	21:00:00
74c4fffd-aacd-429c-8647-80138bcb9b55	60fabd8e-0b74-4a43-a906-bd577f9e8927	6	t	09:00:00	21:00:00
\.

-- public.service_resources
COPY public.service_resources (resource_id,service_id) FROM stdin;
60fabd8e-0b74-4a43-a906-bd577f9e8927	5734e6c8-ba04-4cfa-968b-c356152b385d
cc578e37-187d-498c-9a5a-51d2a1dbefcb	ad6b9c23-c3e1-4167-9230-51ff1c92260c
\.

-- public.resource_unavailability
COPY public.resource_unavailability (id,tenant_id,resource_id,date_from,date_to,reason,notes,created_at,updated_at) FROM stdin;
9eb93ee9-9174-4472-b819-c29786c05178	b1000000-0000-0000-0000-000000000005	60fabd8e-0b74-4a43-a906-bd577f9e8927	2026-05-15	2026-05-31	other	Перенесено из date_overrides миграцией 255	2026-05-06 10:18:44.522009+00	2026-05-06 10:18:44.522009+00
\.

-- public.appointment_settings
COPY public.appointment_settings (id,tenant_id,resource_label,staff_name_format,auto_confirm,booking_horizon_days,slot_step_minutes,allow_client_cancellation,cancellation_deadline_hours,created_at,updated_at,resource_mode,allow_client_reschedule,default_is_bookable,default_booking_mode,default_allow_resource_choice,default_max_duration) FROM stdin;
241033ee-41c5-4744-accd-736a84a7d105	b1000000-0000-0000-0000-000000000005	специалист	full_name	f	30	30	t	2	2026-04-28 06:10:53.253831+00	2026-05-03 09:10:28.065603+00	both	f	t	fixed	t	180
\.

-- public.reservation_settings
COPY public.reservation_settings (id,tenant_id,enabled,slot_step,max_advance_days,min_guests,max_guests,auto_confirm,created_at,updated_at,close_buffer_minutes,max_guests_auto,allow_client_cancellation) FROM stdin;
de43f54a-cdcb-4bc9-8cc2-f1d44ebf6c4a	00000000-0000-0000-0000-000000000002	t	60	10	1	6	f	2026-03-24 05:24:30.837629+00	2026-04-13 06:01:03.943981+00	180	f	t
\.

-- public.order_statuses
COPY public.order_statuses (id,tenant_id,name,group_type,"position",created_at,quick_actions,kitchen_visible) FROM stdin;
00000000-0000-0000-0001-000000000005	00000000-0000-0000-0000-000000000002	Доставляется	in_progress	4	2026-03-09 11:16:17.055048+00	[]	f
00000000-0000-0000-0001-000000000004	00000000-0000-0000-0000-000000000002	Готов	in_progress	3	2026-03-09 11:16:17.055048+00	[]	f
00000000-0000-0000-0001-000000000001	00000000-0000-0000-0000-000000000002	Новый	new	0	2026-03-09 11:16:17.055048+00	["00000000-0000-0000-0001-000000000002", "00000000-0000-0000-0001-000000000007"]	f
00000000-0000-0000-0001-000000000007	00000000-0000-0000-0000-000000000002	Отменён	cancelled	6	2026-03-09 11:16:17.055048+00	[]	f
00000000-0000-0000-0001-000000000006	00000000-0000-0000-0000-000000000002	Выполнен	completed	5	2026-03-09 11:16:17.055048+00	[]	f
00000000-0000-0000-0001-000000000002	00000000-0000-0000-0000-000000000002	Принят	in_progress	1	2026-03-09 11:16:17.055048+00	["00000000-0000-0000-0001-000000000003", "00000000-0000-0000-0001-000000000004"]	f
00000000-0000-0000-0001-000000000003	00000000-0000-0000-0000-000000000002	Готовится	in_progress	2	2026-03-09 11:16:17.055048+00	["00000000-0000-0000-0001-000000000007"]	f
170b0dc4-8484-4937-bc9f-1bc22a4f534c	b1000000-0000-0000-0000-000000000005	Новый	new	0	2026-04-22 10:49:28.555689+00	[]	f
4ad262d3-efe3-4c64-9f1a-160324025178	b1000000-0000-0000-0000-000000000005	Принят	in_progress	1	2026-04-22 10:49:28.555689+00	[]	f
d0b4e3bc-22f3-426f-89f5-d6ffe5336c89	b1000000-0000-0000-0000-000000000005	Готовится	in_progress	2	2026-04-22 10:49:28.555689+00	[]	f
31ad715f-5429-4da8-afea-9a776eb04858	b1000000-0000-0000-0000-000000000005	Готов	in_progress	3	2026-04-22 10:49:28.555689+00	[]	f
8395a85f-ccf7-4922-927c-f244df1b99e8	b1000000-0000-0000-0000-000000000005	Доставляется	in_progress	4	2026-04-22 10:49:28.555689+00	[]	f
7ccdfe42-3714-455b-a732-24c4df821dea	b1000000-0000-0000-0000-000000000005	Выполнен	completed	5	2026-04-22 10:49:28.555689+00	[]	f
9eada7cd-d28e-4ff9-8acb-cf39830a7864	b1000000-0000-0000-0000-000000000005	Отменён	cancelled	6	2026-04-22 10:49:28.555689+00	[]	f
\.

-- public.order_number_counters
COPY public.order_number_counters (tenant_id,period,value) FROM stdin;
00000000-0000-0000-0000-000000000002	global	109
\.

-- public.delivery_zones
COPY public.delivery_zones (id,tenant_id,branch_id,name,color,coordinates,delivery_fee,min_order,sort_order,is_active,created_at,updated_at,free_delivery_from) FROM stdin;
b44f0247-6b42-4a28-a51f-71e970884365	00000000-0000-0000-0000-000000000002	a27dfccb-0eea-48e5-925c-b776415f5abd	Новая зона	#FFD700	[[83.63101726564877, 53.348463598368284], [83.64904171022883, 53.35786132747031], [83.6736751178216, 53.35575600628898], [83.6652637103509, 53.351801827992055], [83.66286045107356, 53.34548464863455]]	0	1000	0	t	2026-03-10 11:31:26.147469+00	2026-03-10 11:31:26.147469+00	2000
8676abb8-7353-40df-8abc-3346fb7ac36f	00000000-0000-0000-0000-000000000002	a27dfccb-0eea-48e5-925c-b776415f5abd	кпкнр	#FFD700	[[83.71286734333275, 53.38717529407307], [83.74298218417428, 53.3873259522491], [83.75192843396403, 53.37821016833336], [83.75545653247266, 53.37534695552618], [83.74915635656438, 53.373161741937814], [83.71299334685091, 53.37640184590547]]	0	0	0	t	2026-03-11 15:34:10.955421+00	2026-03-11 15:34:10.955421+00	0
7eaaf458-e743-4ecc-8b2c-d83daa85c862	00000000-0000-0000-0000-000000000002	a27dfccb-0eea-48e5-925c-b776415f5abd	jfj	#2979FF	[[83.71296205846443, 53.38718696552233], [83.71296205846443, 53.37386840739536], [83.6934515336579, 53.374403174682854]]	0	0	0	t	2026-03-12 08:22:02.25416+00	2026-03-12 08:22:02.25416+00	0
d8dca9a0-7a9b-43c2-9b49-c1b302ebc55c	00000000-0000-0000-0000-000000000002	6ee36e3b-0eaf-4ec3-bb09-5890616612db	Шотландия	#2979FF	[[83.64959464698397, 53.34637255425352], [83.65864972186402, 53.356885042708875], [83.67378656345454, 53.35575305372819], [83.67121870639902, 53.344269743955955]]	149	500	0	t	2026-04-10 07:17:20.019523+00	2026-04-10 07:17:20.019523+00	1200
91083193-29a9-4a08-ba6e-e544e2063258	00000000-0000-0000-0000-000000000002	6ee36e3b-0eaf-4ec3-bb09-5890616612db	Гаражи	#FFD700	[[83.6682209618781, 53.34761643509035], [83.66906997420892, 53.34892500912238], [83.67199006207402, 53.34864020526913], [83.67171992178693, 53.34726234341445]]	99	300	0	t	2026-04-10 07:50:32.346131+00	2026-04-10 07:50:32.346131+00	500
060d952e-6c2e-44e3-aa3a-f3f21f4d13cd	00000000-0000-0000-0000-000000000002	ca634a0d-3848-4c10-800c-28f9fde25160	Балтик	#FFA500	[[83.66916927450502, 53.336001324186746], [83.66728099935854, 53.331582888645976], [83.67594989889467, 53.33065804161033], [83.67706569784487, 53.33512794897872]]	105	500	0	t	2026-04-10 11:53:26.751529+00	2026-04-10 11:53:26.751529+00	1900
\.

COMMIT;
SET session_replication_role = origin;
