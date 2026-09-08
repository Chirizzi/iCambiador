-- ============================================
-- Achou Trocador — Passo 37: segmento do local + reportar cadastro errado
-- "segment" só aparece no painel de confirmação (nunca no formulário de
-- cadastro) e trava depois da primeira confirmação, igual tipo de banheiro.
-- "reported_wrong" é um sinalizador pequeno (ícone de bandeira) pra avisar
-- que aquele cadastro pode estar errado (nome, local, categoria etc.) —
-- só o dono do banco consegue reverter, revisando no Table Editor.
-- Rode isso no SQL Editor do MESMO projeto Supabase dos passos anteriores.
-- ============================================

alter table public.spots
  add column if not exists segment text
    check (segment in ('shopping','restaurante','supermercado','parque','praia','transporte','hospital','turistico','outro')),
  add column if not exists segment_confirmed boolean not null default false,
  add column if not exists reported_wrong boolean not null default false;

grant update (segment, segment_confirmed, reported_wrong) on public.spots to anon;
