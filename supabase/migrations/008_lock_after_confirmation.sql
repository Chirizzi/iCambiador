-- ============================================
-- Achou Trocador — Passo 8: trava campos após a primeira confirmação
-- (tipo de banheiro, pai pode entrar, cobrança). "Continua aberto?"
-- fica de fora de propósito — isso muda de verdade com o tempo.
-- Rode isso no SQL Editor do MESMO projeto Supabase dos passos anteriores.
-- ============================================

alter table public.spots
  add column if not exists location_confirmed boolean not null default false,
  add column if not exists dad_allowed_confirmed boolean not null default false,
  add column if not exists access_type_confirmed boolean not null default false;

-- Locais que já tinham sido confirmados antes deste passo: considera
-- travado o que já tinha um valor preenchido.
update public.spots set
  location_confirmed = verified,
  dad_allowed_confirmed = (dad_allowed is not null and verified),
  access_type_confirmed = (access_type is not null and verified);

grant update (location_confirmed, dad_allowed_confirmed, access_type_confirmed)
  on public.spots to anon;
