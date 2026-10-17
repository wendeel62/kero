-- =====================================================================
-- 027_saas_config.sql — valores configuráveis do SaaS + plano/segmento da loja
-- Os valores (planos, adesão, gasto em anúncios) ficam editáveis pelo dono
-- em /admin/configuracoes e espelham no dashboard. Reexecutável.
-- =====================================================================

-- =========== saas_settings (chave → valor numérico) ===========
create table if not exists saas_settings (
  key text primary key,
  value numeric not null check (value >= 0),
  updated_at timestamptz not null default now()
);

-- defaults: só insere se ainda não existir (não sobrescreve edição do dono)
insert into saas_settings (key, value) values
  ('plan_basico', 57),
  ('plan_completo', 97),
  ('adesao_fee', 100),
  ('ad_spend_daily', 50)
on conflict (key) do nothing;

-- =========== stores: plano + segmento + adesão ===========
alter table if exists stores
  add column if not exists plan text not null default 'basico'
    check (plan in ('basico', 'completo'));

alter table if exists stores
  add column if not exists segment text;

-- adesao_paid_at marca quando o lojista pagou a taxa de criação de cardápio (R$ 100);
-- null = não pagou / não se aplica. Receita de adesão do mês = count no mês × saas_settings.
alter table if exists stores
  add column if not exists adesao_paid_at timestamptz;
