-- ============================================
-- Achou Trocador — Passo 9: marcar "não tem trocador aqui"
-- Pro caso de locais pesquisados que na real não têm trocador (ou nem
-- banheiro). Continua existindo no app, só marcado como tal — assim quem
-- chega via Google Maps achando que tem, confere aqui e já sabe que não tem.
-- Rode isso no SQL Editor do MESMO projeto Supabase dos passos anteriores.
-- ============================================

alter table public.spots
  add column if not exists has_changing_table boolean,
  add column if not exists has_changing_table_confirmed boolean not null default false;

grant update (has_changing_table, has_changing_table_confirmed) on public.spots to anon;
