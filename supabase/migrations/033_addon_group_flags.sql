-- 033_addon_group_flags.sql — flags redundantes em product_addon_groups (já existem em product_addons via 032).
-- Limpa se tiver sido aplicado por engano.
alter table product_addon_groups drop column if exists is_removal;
alter table product_addon_groups drop column if exists is_separate;
