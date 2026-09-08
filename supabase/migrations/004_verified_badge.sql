-- ============================================
-- Achou Trocador — Passo 4: selo de verificado
-- Rode isso no SQL Editor do MESMO projeto Supabase dos passos anteriores.
-- ============================================

-- Locais cadastrados por uma pessoa de verdade já nascem verificados
-- (padrão true); os 100 locais pesquisados no Passo 5 vão entrar como
-- false explicitamente, já que ninguém visitou ainda.
alter table public.spots
  add column if not exists verified boolean not null default true;

-- Confirmar qualquer informação (aberto/pai/cobrança) também verifica o local
revoke update on public.spots from anon;
grant update (dad_allowed, is_paid, still_open, last_confirmed_at, verified) on public.spots to anon;
