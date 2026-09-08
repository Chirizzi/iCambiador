# Supabase — configuração do banco

Scripts SQL na ordem em que devem ser rodados no **SQL Editor** do Supabase,
num projeto novo (veja o [README principal](../README.md) pra criar o projeto
e pegar a URL/chave). Cada arquivo é uma query separada — cole um de cada vez.

| Arquivo | O que faz |
|---|---|
| `001_spots_table_and_realtime.sql` | Cria a tabela `spots`, RLS básica (ler/cadastrar), tempo real, 2 locais de exemplo |
| `002_favorites_ratings_photos.sql` | Campos `dad_allowed`/`is_paid`, avaliação (1-5 estrelas), fotos com fila de aprovação |
| `003_confirmations_still_open.sql` | Campo "continua aberto?" e permissão pra confirmar informações |
| `004_verified_badge.sql` | Campo `verified` (selo azul de verificado) |
| `005_seed_buenos_aires_100.sql` | 100 locais pesquisados em Buenos Aires (não verificados) |
| `006_confirm_location.sql` | Permite confirmar/corrigir o tipo de banheiro |
| `007_access_type.sql` | Troca `is_paid` (sim/não) por `access_type` (gratuito/cobra/só clientes) |
| `008_lock_after_confirmation.sql` | Trava tipo de banheiro/pai/cobrança depois da primeira confirmação |
| `009_has_changing_table.sql` | Campo "tem trocador aqui?" pra marcar locais sem trocador de verdade |
| `010_seed_florianopolis_100.sql` | 100 locais pesquisados em Florianópolis (não verificados) |

Depois de rodar tudo, pegue a **Project URL** e a chave **anon public** em
Project Settings → API, e cole no topo do `app.js`.
