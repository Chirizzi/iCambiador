-- ============================================
-- Achou Trocador — Passo 7: 3 opções de cobrança
-- (gratuito / cobra entrada / só para clientes, tipo restaurante)
-- Rode isso no SQL Editor do MESMO projeto Supabase dos passos anteriores.
-- ============================================

-- 1) Novo campo, migrando o que já existia em is_paid
alter table public.spots add column if not exists access_type text
  check (access_type in ('free', 'paid', 'customers'));

update public.spots
set access_type = case
  when is_paid = true then 'paid'
  when is_paid = false then 'free'
  else null
end
where access_type is null;

alter table public.spots drop column if exists is_paid;

-- 2) Ajusta as permissões: is_paid não existe mais, access_type entra no lugar
revoke update on public.spots from anon;
grant update (dad_allowed, still_open, last_confirmed_at, verified, location, access_type)
  on public.spots to anon;
