-- ============================================
-- Achou Trocador — Passo 2
-- Rode isso no SQL Editor do MESMO projeto Supabase do Passo 1.
-- ============================================

-- 1) Novos campos no local: pai pode entrar? / cobra entrada?
alter table public.spots add column if not exists dad_allowed boolean;
alter table public.spots add column if not exists is_paid boolean;

-- 2) Avaliações (1 a 5 estrelas) — uma por dispositivo por local
create table public.spot_ratings (
  id uuid primary key default gen_random_uuid(),
  spot_id text not null references public.spots(id) on delete cascade,
  device_id text not null,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  unique (spot_id, device_id)
);

alter table public.spot_ratings enable row level security;

create policy "Qualquer um pode ler as avaliações"
on public.spot_ratings for select
to anon
using (true);

create policy "Qualquer um pode avaliar"
on public.spot_ratings for insert
to anon
with check (true);

create policy "Qualquer um pode mudar a própria avaliação"
on public.spot_ratings for update
to anon
using (true)
with check (true);

-- Média e contagem por local, prontas pra consultar direto
create view public.spot_ratings_summary as
select
  spot_id,
  round(avg(rating)::numeric, 1) as avg_rating,
  count(*) as ratings_count
from public.spot_ratings
group by spot_id;

grant select on public.spot_ratings_summary to anon;

-- 3) Fotos, com fila de aprovação
create table public.spot_photos (
  id uuid primary key default gen_random_uuid(),
  spot_id text not null references public.spots(id) on delete cascade,
  storage_path text not null,
  device_id text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

alter table public.spot_photos enable row level security;

-- Só fotos já aprovadas ficam visíveis publicamente
create policy "Só fotos aprovadas são públicas"
on public.spot_photos for select
to anon
using (status = 'approved');

-- Quem sobe uma foto só consegue criá-la como pendente
-- (não dá pra já subir marcada como aprovada)
create policy "Qualquer um pode enviar foto (fica pendente)"
on public.spot_photos for insert
to anon
with check (status = 'pending');

-- Pra aprovar uma foto: Table Editor → spot_photos → troque "status" pra "approved"

-- 4) Bucket de armazenamento das fotos
insert into storage.buckets (id, name, public)
values ('spot-photos', 'spot-photos', true)
on conflict (id) do nothing;

create policy "Leitura pública das fotos"
on storage.objects for select
to public
using (bucket_id = 'spot-photos');

create policy "Qualquer um pode subir foto"
on storage.objects for insert
to anon
with check (bucket_id = 'spot-photos');
