-- 1) Tabela dos locais
create table public.spots (
  id text primary key,
  name text not null,
  lat double precision not null,
  lng double precision not null,
  location text not null,
  notes text,
  created_at timestamptz not null default now()
);

-- 2) Segurança: liga RLS e permite acesso público de leitura/escrita
--    (não tem login de usuário no app, então "anon" é todo mundo que abre o app)
alter table public.spots enable row level security;

create policy "Qualquer um pode ler os locais"
on public.spots for select
to anon
using (true);

create policy "Qualquer um pode cadastrar um local"
on public.spots for insert
to anon
with check (true);

-- 3) Opcional: os 2 locais de exemplo, pra não começar com o mapa vazio
insert into public.spots (id, name, lat, lng, location, notes) values
  ('seed-1', 'Alto Palermo Shopping — praça de alimentação', -34.5885, -58.4106, 'familia', 'Banheiro família no 2º piso, perto do patio de comidas.'),
  ('seed-2', 'Parque Las Heras', -34.5836, -58.4114, 'ambos', 'Trocador nos dois banheiros públicos do parque.');

-- 4) Liga o "tempo real": quem já está com o app aberto vê novos locais na hora
alter publication supabase_realtime add table public.spots;
