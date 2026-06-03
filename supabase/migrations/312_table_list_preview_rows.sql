-- Сколько позиций показывать на карточке стола в списке до сворачивания под «ещё».
-- Настройка тенанта: было захардкожено 3 в TableCard.vue, теперь редактируется в /tables/settings.
alter table table_settings
  add column list_preview_rows int not null default 3 check (list_preview_rows between 1 and 50);
