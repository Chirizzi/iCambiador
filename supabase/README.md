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
| `011_seed_presidente_prudente_100.sql` | 100 locais em Presidente Prudente (não verificados) |
| `012_seed_sao_paulo_100.sql` | 100 locais em São Paulo (não verificados) |
| `013_seed_sorocaba_100.sql` | 100 locais em Sorocaba (não verificados) |
| `014_seed_mar_del_plata_100.sql` | 100 locais em Mar del Plata (não verificados) |
| `015_seed_mendoza_100.sql` | 100 locais em Mendoza (não verificados) |
| `016_seed_cordoba_100.sql` | 100 locais em Córdoba (não verificados) |
| `017_seed_rosario_100.sql` | 100 locais em Rosario (não verificados) |
| `018_seed_porto_alegre_100.sql` | 100 locais em Porto Alegre (não verificados) |
| `019_seed_curitiba_100.sql` | 100 locais em Curitiba (não verificados) |
| `020_seed_rio_de_janeiro_100.sql` | 100 locais no Rio de Janeiro (não verificados) |
| `021_seed_salvador_100.sql` | 100 locais em Salvador (não verificados) |
| `022_seed_buenos_aires_200_extra.sql` | +200 locais em Buenos Aires (não verificados) |
| `023_seed_sao_paulo_200_extra.sql` | +200 locais em São Paulo (não verificados) |
| `024_seed_salta_100.sql` | 100 locais em Salta (não verificados) |
| `025_seed_bariloche_100.sql` | 100 locais em Bariloche (não verificados) |
| `026_seed_puerto_iguazu_100.sql` | 100 locais em Puerto Iguazú (não verificados) |
| `027_seed_foz_do_iguacu_100.sql` | 100 locais em Foz do Iguaçu (não verificados) |
| `028_seed_rio_gallegos_100.sql` | 100 locais em Río Gallegos (não verificados) |
| `029_seed_ushuaia_100.sql` | 100 locais em Ushuaia (não verificados) |
| `030_seed_comodoro_rivadavia_100.sql` | 100 locais em Comodoro Rivadavia (não verificados) |
| `031_seed_gramado_100.sql` | 100 locais em Gramado (não verificados) |
| `032_seed_santa_maria_100.sql` | 100 locais em Santa Maria/RS (não verificados) |
| `033_seed_balneario_camboriu_100.sql` | 100 locais em Balneário Camboriú (não verificados) |
| `034_seed_blumenau_100.sql` | 100 locais em Blumenau (não verificados) |
| `035_seed_itapema_100.sql` | 100 locais em Itapema (não verificados) |
| `036_seed_campos_do_jordao_100.sql` | 100 locais em Campos do Jordão (não verificados) |
| `037_segment_and_report_wrong.sql` | Campo "tipo de lugar" (segmento) na confirmação + reportar cadastro errado |

Depois de rodar tudo, pegue a **Project URL** e a chave **anon public** em
Project Settings → API, e cole no topo do `app.js`.
