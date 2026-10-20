-- 032_addon_flags.sql — flags de remocao e separacao em product_addons.
alter table product_addons add column if not exists is_removal boolean not null default false;
alter table product_addons add column if not exists is_separate boolean not null default false;
