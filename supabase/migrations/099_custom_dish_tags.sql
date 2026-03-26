-- 1. Create dish_tags table
create table dish_tags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  icon text not null default 'Tag',
  color text not null default 'slate',
  is_virtual_category boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_dish_tags_tenant on dish_tags(tenant_id);

-- 2. Create junction table
create table dish_tag_assignments (
  dish_id uuid not null references dishes(id) on delete cascade,
  tag_id uuid not null references dish_tags(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  sort_order int not null default 0,
  primary key (dish_id, tag_id)
);

create index idx_dta_tag on dish_tag_assignments(tag_id);
create index idx_dta_tenant on dish_tag_assignments(tenant_id);

-- Also support combos
create table combo_tag_assignments (
  combo_id uuid not null references combos(id) on delete cascade,
  tag_id uuid not null references dish_tags(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  primary key (combo_id, tag_id)
);

create index idx_cta_tag on combo_tag_assignments(tag_id);
create index idx_cta_tenant on combo_tag_assignments(tenant_id);

-- 3. RLS
alter table dish_tags enable row level security;
alter table dish_tag_assignments enable row level security;
alter table combo_tag_assignments enable row level security;

-- dish_tags policies
create policy "dish_tags: member can select" on dish_tags for select using (is_tenant_member(tenant_id));
create policy "dish_tags: manager can insert" on dish_tags for insert with check (has_tenant_role(tenant_id, 'manager'));
create policy "dish_tags: manager can update" on dish_tags for update using (has_tenant_role(tenant_id, 'manager'));
create policy "dish_tags: manager can delete" on dish_tags for delete using (has_tenant_role(tenant_id, 'manager'));
create policy "service_role_all" on dish_tags for all to service_role using (true) with check (true);

-- dish_tag_assignments policies
create policy "dta: member can select" on dish_tag_assignments for select using (is_tenant_member(tenant_id));
create policy "dta: manager can insert" on dish_tag_assignments for insert with check (has_tenant_role(tenant_id, 'manager'));
create policy "dta: manager can update" on dish_tag_assignments for update using (has_tenant_role(tenant_id, 'manager'));
create policy "dta: manager can delete" on dish_tag_assignments for delete using (has_tenant_role(tenant_id, 'manager'));
create policy "service_role_all" on dish_tag_assignments for all to service_role using (true) with check (true);

-- combo_tag_assignments policies
create policy "cta: member can select" on combo_tag_assignments for select using (is_tenant_member(tenant_id));
create policy "cta: manager can insert" on combo_tag_assignments for insert with check (has_tenant_role(tenant_id, 'manager'));
create policy "cta: manager can delete" on combo_tag_assignments for delete using (has_tenant_role(tenant_id, 'manager'));
create policy "service_role_all" on combo_tag_assignments for all to service_role using (true) with check (true);

-- 4. Migrate existing data: create tags per tenant and assign them
do $$
declare
  t record;
  tag_map jsonb;
  d record;
  new_tag_id uuid;
  tag_key text;
  tag_name text;
  tag_icon text;
  tag_color text;
  is_vc boolean;
begin
  for t in select distinct tenant_id from dishes loop
    tag_map := '{}'::jsonb;

    -- Collect all unique tags used by this tenant
    for tag_key in
      select distinct unnest(tags) from dishes where tenant_id = t.tenant_id and deleted_at is null
      union
      select distinct unnest(tags) from combos where tenant_id = t.tenant_id
    loop
      -- Map old tag key to name/icon/color
      case tag_key
        when 'spicy' then tag_name := 'Острое'; tag_icon := 'Flame'; tag_color := 'red'; is_vc := false;
        when 'vegetarian' then tag_name := 'Вегетарианское'; tag_icon := 'Leaf'; tag_color := 'green'; is_vc := false;
        when 'vegan' then tag_name := 'Веган'; tag_icon := 'Leaf'; tag_color := 'green'; is_vc := false;
        when 'new' then tag_name := 'Новинка'; tag_icon := 'Sparkles'; tag_color := 'primary'; is_vc := true;
        when 'popular' then tag_name := 'Популярное'; tag_icon := 'Star'; tag_color := 'amber'; is_vc := false;
        when 'hit' then tag_name := 'Хит'; tag_icon := 'Zap'; tag_color := 'amber'; is_vc := true;
        else tag_name := tag_key; tag_icon := 'Tag'; tag_color := 'slate'; is_vc := false;
      end case;

      insert into dish_tags (tenant_id, name, icon, color, is_virtual_category, sort_order)
      values (t.tenant_id, tag_name, tag_icon, tag_color, is_vc, 0)
      returning id into new_tag_id;

      tag_map := tag_map || jsonb_build_object(tag_key, new_tag_id::text);
    end loop;

    -- Assign tags to dishes
    for d in select id, tags from dishes where tenant_id = t.tenant_id and deleted_at is null and array_length(tags, 1) > 0 loop
      for tag_key in select unnest(d.tags) loop
        if tag_map ? tag_key then
          insert into dish_tag_assignments (dish_id, tag_id, tenant_id)
          values (d.id, (tag_map ->> tag_key)::uuid, t.tenant_id)
          on conflict do nothing;
        end if;
      end loop;
    end loop;

    -- Assign tags to combos
    for d in select id, tags from combos where tenant_id = t.tenant_id and array_length(tags, 1) > 0 loop
      for tag_key in select unnest(d.tags) loop
        if tag_map ? tag_key then
          insert into combo_tag_assignments (combo_id, tag_id, tenant_id)
          values (d.id, (tag_map ->> tag_key)::uuid, t.tenant_id)
          on conflict do nothing;
        end if;
      end loop;
    end loop;
  end loop;
end;
$$;

-- 5. Drop old columns and table
alter table dishes drop column tags;
alter table combos drop column tags;
drop table if exists dish_tag_orders;

-- 6. Add tag_id to categories, migrate virtual categories, simplify types
alter table categories add column tag_id uuid references dish_tags(id) on delete cascade;

do $$
declare
  cat record;
  matching_tag_id uuid;
begin
  for cat in select id, tenant_id, type from categories where type in ('new', 'hit') and deleted_at is null loop
    if cat.type = 'new' then
      select id into matching_tag_id from dish_tags where tenant_id = cat.tenant_id and is_virtual_category = true and name in ('Новинка', 'Новинки') limit 1;
    elsif cat.type = 'hit' then
      select id into matching_tag_id from dish_tags where tenant_id = cat.tenant_id and is_virtual_category = true and name in ('Хит', 'Популярное', 'Хит продаж') limit 1;
    end if;

    update categories set tag_id = matching_tag_id, type = 'regular' where id = cat.id;
  end loop;
end;
$$;

alter table dish_tags drop column is_virtual_category;

alter table categories drop constraint categories_type_check;
alter table categories add constraint categories_type_check check (type in ('regular', 'combo'));

drop index if exists categories_tenant_special_type;
create unique index categories_tenant_combo on categories (tenant_id) where type = 'combo' and deleted_at is null;
