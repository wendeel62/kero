-- 010_storefront_texts — C-04 (texto do letreiro por loja) + C-07 (foto de capa).
-- Nulável: null/vazio = letreiro oculto na vitrine. Leitura anon já coberta
-- pela policy "anon_select" em stores (table-level); escrita via "lojista_all".
alter table stores add column if not exists marquee_text text;
alter table stores add column if not exists cover_url text;
