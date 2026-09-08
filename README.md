# Achou Trocador

Protótipo funcional (PWA) pra encontrar e cadastrar trocadores de fralda perto de você,
com destaque pra qual banheiro o trocador fica (feminino/masculino/família) — o problema
que motivou o app.

## O que já funciona
- Mapa (OpenStreetMap, sem precisar de chave de API) centrado em Buenos Aires
- Localização do usuário via GPS do navegador
- Botão "Preciso agora" → acha e centraliza no trocador mais perto
- Cadastro de novo local: nome, onde fica o trocador, notas, ponto no mapa
- Lista ordenada por distância
- Funciona como app instalável (PWA) — "Adicionar à Tela de Início" no Safari/Chrome
- Dados compartilhados entre todo mundo que abre o app, via Supabase (banco
  gratuito até um volume razoável de uso), com atualização em tempo real
- Favoritos (marcados por dispositivo, sem precisar de login)
- Avaliação de 1 a 5 estrelas por local (uma avaliação por dispositivo)
- Foto por local, com fila de aprovação (aparece pra todo mundo só depois
  de aprovada no Table Editor do Supabase)
- Indicação se o local permite entrada do pai e se cobra entrada
- Links de "como chegar" pro Google Maps e Apple Maps
- Interface em português, espanhol e inglês, escolhida automaticamente
  pelo idioma do aparelho (força um idioma específico pra testar: adicione
  `?lang=es`, `?lang=en` ou `?lang=pt` na URL)
- Confirmação comunitária: qualquer pessoa pode confirmar/corrigir o tipo
  de banheiro, se continua aberto, se aceita pai e o tipo de cobrança
  (gratuito / cobra entrada / só pra clientes, tipo restaurante), com a
  data da última confirmação visível no popup
- Selo de "verificado" (✓ azul) assim que alguém confirma qualquer
  informação de um local pela primeira vez
- Busca de endereço ao cadastrar um local (via Nominatim/OpenStreetMap,
  sem chave de API), parecido com a busca do Google Maps

## Configuração necessária (Supabase)
Este app guarda os locais num projeto Supabase, não mais no celular.
1. Crie um projeto grátis em [supabase.com](https://supabase.com)
2. No **SQL Editor** do projeto, rode em ordem os scripts de
   [`supabase/migrations`](supabase/) (veja o [README dessa pasta](supabase/README.md)
   pra saber o que cada um faz)
3. Em **Project Settings → API**, copie a **Project URL** e a chave **anon public**
4. Cole os dois valores no topo de `app.js`, nas constantes `SUPABASE_URL` e
   `SUPABASE_ANON_KEY`

A chave `anon` é pública por design (fica visível no código do app) — quem
protege os dados é a Row Level Security configurada no banco. Fotos novas
ficam pendentes até você aprová-las manualmente no Table Editor
(`spot_photos` → mudar `status` pra `approved`).

## Como testar agora, sem instalar nada
1. Abra um terminal nesta pasta
2. Rode: `python3 -m http.server 8080`
3. No navegador do computador: `http://localhost:8080`
4. Pra testar no celular na mesma rede Wi-Fi: descubra o IP do seu computador
   (`ipconfig` no Windows / `ifconfig` ou `ip a` no Mac/Linux) e acesse
   `http://SEU-IP:8080` pelo celular

---

## Roadmap: como evoluir isso com o Claude Code

### Passo 2 — Polir para uso diário ✅
- ~~Botão de favoritos~~ feito
- ~~Avaliação (1-5 estrelas) e fotos por local~~ feito
- ~~Indicar se permite pai e se cobra entrada~~ feito
- ~~Integração com Google Maps / Apple Maps~~ feito
- ~~Interface em pt/es/en com detecção automática~~ feito
- ~~Confirmação comunitária (continua aberto? cobra? aceita pai?) com data~~ feito
- Ainda falta: modo offline mais robusto (cache dos locais já vistos)

### Passo 2.5 — Financiar o app com ads
- Antes de sair colocando banner, vale decidir: rede de anúncios (Google
  AdSense — precisa de aprovação de conta e volume de tráfego) vs.
  patrocínio direto (um espaço fixo pra negócios locais, sem intermediário,
  mais simples de montar e com receita mais previsível num app pequeno)
- Se for AdSense: a criação da conta é sua (não dá pra automatizar), mas o
  Claude Code te ajuda a montar o slot de anúncio no layout sem atrapalhar
  a experiência (ex: não colocar banner perto do botão "Preciso agora")

### Passo 3 — Se quiser ir para as lojas de verdade (App Store / Play Store)
Nesse ponto vale migrar de PWA para um app nativo:
- **React Native + Expo** é o caminho mais direto vindo de um protótipo web
  (reaproveita boa parte da lógica em JS)
- Vai precisar de conta de desenvolvedor: Apple (US$99/ano) e/ou
  Google Play (US$25 único)
- O Claude Code te ajuda a configurar o projeto Expo, portar as telas,
  testar num simulador, e gerar o build para submissão

### Passo 4 — Crescer a base de dados sem fazer tudo sozinho
- Importar dados públicos existentes (ex: OpenStreetMap já tem tags
  `changing_table=yes` em muitos locais — dá pra puxar isso via Overpass API
  como carga inicial pra Buenos Aires)
- Permitir que qualquer pessoa que usa o app contribua (já é a lógica atual)

---

## Como continuar isso no Claude Code

1. Abra o Claude Code (desktop, terminal, ou VS Code/JetBrains)
2. Aponte pra esta pasta como projeto
3. Peça, por exemplo: *"Quero adicionar um botão de favoritos pros locais
   que eu mais uso"*
4. A partir daí é iteração normal de desenvolvimento: você testa, pede ajustes,
   até ficar do jeito que quer

## Estrutura dos arquivos
```
index.html       → estrutura da tela
style.css        → visual (paleta navy/menta/coral, tipografia Fraunces + Inter)
app.js           → toda a lógica (mapa, dados, formulário)
i18n.js          → traduções (pt/es/en) e detecção de idioma
manifest.json    → configuração de instalação como PWA
service-worker.js → cache básico offline
icon-192.png / icon-512.png → ícones do app
supabase/        → scripts SQL do banco, em ordem (veja supabase/README.md)
```
