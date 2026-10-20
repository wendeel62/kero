-- 031_addon_group_pricing.sql — colunas de preço/preparação em product_addon_groups.
alter table product_addon_groups add column if not exists price_rule text not null default 'sum' check (price_rule in ('sum','max','avg'));
alter table product_addon_groups add column if not exists free_addons integer check (free_addons is null or free_addons >= 0);
alter table product_addon_groups add column if not exists min_choices integer check (min_choices is null or min_choices >= 0);
alter table product_addon_groups add column if not exists is_preparation boolean not null default false;
