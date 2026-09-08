-- ============================================
-- Achou Trocador — Passo 3: confirmação de informações
-- Rode isso no SQL Editor do MESMO projeto Supabase dos passos anteriores.
-- ============================================

-- 1) Novos campos: continua aberto? / quando foi confirmado pela última vez?
alter table public.spots
  add column if not exists still_open boolean,
  add column if not exists last_confirmed_at timestamptz;

-- Locais já cadastrados: considera a data de criação como a "última confirmação"
-- (melhor do que mostrar "nunca confirmado" pra tudo que já existe)
update public.spots
set last_confirmed_at = created_at
where last_confirmed_at is null;

-- 2) Permite confirmar/atualizar essas informações — mas SÓ essas colunas.
-- Não dá pra usar isso pra reescrever nome, endereço ou notas de um local.
create policy "Qualquer um pode confirmar informações do local"
on public.spots for update
to anon
using (true)
with check (true);

revoke update on public.spots from anon;
grant update (dad_allowed, is_paid, still_open, last_confirmed_at) on public.spots to anon;
