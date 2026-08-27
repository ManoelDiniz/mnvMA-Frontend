# MNVMA Care

Painel PWA do **MNVMA** — gestão de clientes, plantões, escalas e financeiro
para cuidadores independentes e empresas de cuidadores.

React 19 · Vite 6 · TypeScript · Tailwind 4 · TanStack Query · Workbox

> Projeto **separado** do backend ([`mnvMA-backend`](https://github.com/ManoelDiniz/mnvMA-backend)), publicado
> em outro lugar. O contrato entre os dois é só HTTP + JSON + JWT.
> Planejamento da plataforma em
> [`docs/mnvma/`](https://github.com/ManoelDiniz/mnvMA-backend/tree/main/docs/mnvma), no repositório do backend —
> inclusive [`02-frontend-pwa.md`](https://github.com/ManoelDiniz/mnvMA-backend/blob/main/docs/mnvma/02-frontend-pwa.md),
> que é o documento deste painel.

---

## Como rodar

```bash
cp .env.example .env      # aponte VITE_API_URL para a sua API
npm install
npm run icons             # gera os ícones do PWA (só quando a marca mudar)
npm run dev
```

- Painel: <http://localhost:5173>
- Precisa da API rodando em <http://localhost:3000/v1>

Para testar o comportamento de PWA (service worker, instalação, offline) é
preciso build — em `dev` o service worker fica desligado de propósito, senão o
cache atrapalha o desenvolvimento:

```bash
npm run build && npm run preview
```

---

## Decisões que valem explicação

### O access token não vai para o `localStorage`

Fica numa variável de módulo, em memória. A continuidade da sessão vem do
refresh token em cookie `httpOnly`, que o JavaScript não alcança. JWT em
`localStorage` é o padrão mais comum e o mais perigoso: qualquer XSS lê o token
e assume a sessão — e este app manipula dado pessoal de saúde.

O custo é que, ao abrir o PWA, não existe token: o boot chama
`POST /auth/refresh` e mostra o splash até resolver.

### Um refresh por vez

Se cinco requisições tomarem 401 juntas, precisa acontecer **um** refresh. Sem a
fila em `shared/api/client.ts`, refreshes concorrentes rotacionam o token uns dos
outros, o backend interpreta como reuso (que é o padrão de token roubado) e
derruba a sessão legítima.

### O menu vem do servidor

`GET /auth/me` devolve `permissions` e `modules`; o menu é montado a partir
disso. Um cuidador independente não tem "Escalas" porque o backend não mandou o
módulo — não porque um `if` no cliente escondeu. Esconder no cliente é
cosmético; a API é quem recusa.

### Mobile-first não é estilo, é o caso de uso

O público é cuidador de 40+ anos, muitas vezes em pé, na rua, com uma mão só, às
vezes de madrugada. Daí:

- nenhum alvo de toque abaixo de 44px;
- base 16px, nada de conteúdo em 13px;
- listas viram cartões no celular, não tabelas com rolagem lateral;
- ação principal no alcance do polegar (botão flutuante, barra de ação fixa);
- contraste AA nos dois temas, inclusive no texto secundário;
- estado sempre com rótulo, nunca só com cor.

Isso é uma divergência consciente do que uma referência de "dashboard" sugeriria
(densidade alta, fonte monoespaçada, muitos widgets): aquilo serve analista de
BI no desktop, não é este produto.

### Fonte do sistema, sem Google Fonts

Um app que precisa abrir offline não deveria depender de fonte remota. A stack
do sistema renderiza na hora, tem acentuação impecável em pt-BR e não custa
requisição nenhuma.

### Gráfico em CSS, sem biblioteca

O fluxo de caixa desenha as barras com CSS puro. São poucos pontos e o dado é
simples; economizar ~45KB de bundle vale mais para quem abre o app no 4G. Cada
barra também traz o valor em texto — gráfico sem número não serve para conferir
dinheiro, e não seria acessível a leitor de tela.

### `registerType: 'prompt'`

O app **não** se atualiza sozinho. Recarregar no meio do cadastro de um cliente
perde o que a pessoa digitou; aparece um aviso e ela decide quando.

---

## Estrutura

```text
src/
├── app/
│   ├── router.tsx        # rotas com lazy loading por tela
│   ├── guards.tsx        # ExigirAutenticacao / ExigirAnonimo
│   ├── navigation.ts     # catálogo do menu (filtrado por módulo e permissão)
│   ├── AvisosPwa.tsx     # atualização, offline, convite de instalação
│   └── layout/           # AppShell, faixa de status da conta
├── features/
│   ├── auth/             # store de sessão, entrar, criar conta
│   ├── caregivers/       # equipe
│   ├── customers/        # lista, detalhe, formulário  ← padrão a copiar
│   ├── dashboard/
│   ├── finance/          # a receber, a pagar, fluxo de caixa
│   ├── reports/          # rentabilidade e operação
│   ├── services/         # catálogo com prévia de margem
│   └── shifts/           # agenda, plantões, calendario.ts (com testes)
├── shared/
│   ├── api/              # client HTTP, tipos do contrato
│   ├── hooks/            # tema, online, instalação
│   ├── lib/              # formatação pt-BR, cn()
│   └── ui/               # Button, Field, Card, estados de feedback
└── styles/index.css      # tokens do design system
```

Regra: `features/` não importa de outra `features/`. O que for compartilhado
sobe para `shared/`.

---

## Os cinco estados

Toda lista precisa dos cinco desenhados — estão juntos em
`shared/ui/feedback.tsx` justamente para ninguém esquecer um:

1. **Carregando** — esqueleto no formato do conteúdo, nunca spinner de tela cheia
2. **Vazio** — explica o que fazer e oferece a ação
3. **Erro** — mensagem clara e "Tentar novamente"
4. **Offline** — mostra o cache com selo de quando foi salvo
5. **Sem permissão** — o item nem aparece no menu; por URL, tela explicativa

Somados aos estados da conta: `TRIAL` (contador), `PAST_DUE` (faixa vermelha),
`SUSPENDED` (leitura e exportação liberadas, escrita bloqueada).

---

## Deploy

Build estático — Vercel, Netlify ou Cloudflare Pages servem igualmente.
`vercel.json` já traz as regras necessárias:

- rewrite de todas as rotas para `/index.html` (SPA)
- `assets/*` imutável por 1 ano
- **`sw.js` com `no-cache`** — se o CDN cachear o service worker, o usuário fica
  preso numa versão antiga para sempre. É o erro clássico de PWA em produção.

Checklist:

- [ ] HTTPS (service worker não roda sem)
- [ ] `VITE_API_URL` apontando para a API do ambiente
- [ ] CORS da API liberado para a origem exata do painel
- [ ] Testar instalação num Android **e** num iPhone de verdade

---

## Estado atual

Sprints 0 a 5 do roadmap:

- [x] Base: Vite, Tailwind 4 com tokens, tema claro/escuro sem piscar
- [x] PWA instalável: manifest, ícones (inclusive maskable), service worker
- [x] Avisos de atualização, offline e instalação — com instrução própria no iOS
- [x] Sessão: entrar, criar conta com escolha de tipo, refresh silencioso, sair
- [x] Shell: sidebar no desktop, barra inferior no celular, menu vindo da API
- [x] Faixa de status da conta (trial, atraso, suspensão)
- [x] Clientes: lista com busca, detalhe, formulário com responsáveis
- [x] Serviços com prévia de margem enquanto se digita
- [x] Cuidadores: lista e formulário
- [x] Agenda em mês/semana/dia, formulário e detalhe de plantão
- [x] Financeiro: a receber, a pagar, baixa com valor ajustável, fluxo de caixa
- [x] Início com números reais do mês
- [x] Disponibilidade: rotina semanal e bloqueios de período
- [x] Relatórios com rentabilidade e exportação CSV (abre no Excel em pt-BR)
- [ ] Fila de escrita offline e push (Sprint 9)
