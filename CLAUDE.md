# Gestão 3D — Contexto do projeto

Sistema web de gestão de projetos e produção de impressão 3D, feito para o Thiago
(uso pessoal, usuário único). Impressora: **Bambu Lab A1 Combo com AMS**
(multicolor/multimaterial, até 4 slots por impressão).

- **Produção**: https://gestao-impressora.vercel.app (deploy automático via Vercel a cada push)
- **Idioma da UI**: português do Brasil. Dark mode é o padrão.
- **Branch de trabalho**: `claude/awesome-meitner-4sovw5`

## Stack

React 18 + Vite · Firebase Auth (e-mail/senha) + Cloud Firestore (tempo real) ·
Tailwind CSS v3 (dark mode via classe, design system em `@layer components` no `src/index.css`) ·
Recharts · jsPDF + jspdf-autotable · SheetJS (xlsx) · react-router-dom v6 · lucide-react v1.x

## Comandos

```bash
npm run dev      # desenvolvimento local
npm run build    # build de produção — SEMPRE rodar antes de commitar mudanças de código
```

## Arquitetura

- `src/lib/calculations.js` — TODA a lógica de negócio pura: custo/grama da bobina,
  custo de energia, depreciação da impressora, custos do projeto (estimado × real),
  preços com margens, alertas de estoque, manutenção por horas, estatísticas de desperdício.
- `src/lib/ops.js` — operações de domínio com `writeBatch` do Firestore (atômicas):
  concluir impressão (desconta gramas das bobinas + soma horas na impressora),
  registrar falha, marcar pedido como pago (lança receita), reabastecer bobina, duplicar projeto.
- `src/lib/db.js` — `makeApi(uid)`: CRUD genérico com log de atividade automático.
- `src/lib/seed.js` — primeira entrada do usuário cria settings + 20 materiais padrão.
- `src/lib/format.js` — `money()`, `grams()`, `dateBR()`, `toNum()`, `toDate()` etc.
- `src/lib/constants.js` — materiais, status, motivos de falha, tipos de manutenção, defaults.
- `src/contexts/DataContext.jsx` — assina TODAS as 14 coleções do Firestore em tempo real;
  expõe `printersById`, `spoolsById`, `projectsById`, `clientsById`, `api`.
- `src/pages/` — 13 módulos: Dashboard, Impressoras, Filamentos, Projetos (+ ProjectDetail
  com 5 abas), Produção, Pedidos, Clientes, Financeiro, Manutenção, Biblioteca,
  Relatórios, Configurações, Login.
- `src/components/ui/` — Modal, DataTable (busca/filtro/ordenação), SearchSelect,
  Field (Input/Select/Textarea/FormGrid), Badge, Tabs, ConfirmDialog.
- `src/components/domain/SlotEditor.jsx` — editor de slots AMS (até 4 por parte,
  cada slot aponta para uma bobina específica com gramas da peça + gramas de purga).

## Modelo de dados (Firestore)

Tudo fica em `users/{uid}/...` — regras em `firestore.rules` permitem acesso apenas
ao próprio usuário. Coleções: printers, spools, projects, clients, orders, transactions,
maintenanceRecords, maintenanceParts, profiles, materials, suppliers, templates,
packagingItems, activityLog + doc único `settings/main`.

Conceito central: cada **projeto** tem `parts[]`; cada parte tem `slots[]` (1–4);
cada slot referencia uma bobina por ID com `gramsPiece` + `gramsPurge`.
Custo = soma de (gramas peça + purga) × custo/grama da bobina de cada slot.

## Convenções

- Lógica de negócio NUNCA dentro de componentes — sempre em `src/lib/`.
- Operações que tocam múltiplos documentos usam `writeBatch` (ver `ops.js`).
- Valores monetários: `money()` · datas: `dateBR()` / `dateTimeBR()` · entrada numérica:
  inputs `type="text"` com `inputMode` + conversão via `toNum()`.
- lucide-react v1.x NÃO tem ícones de marcas (Instagram etc.) — usar alternativas (ex.: `AtSign`).
- Cadastro público está REMOVIDO da tela de login de propósito (sistema pessoal);
  contas são criadas só pelo Firebase Console. Não reintroduzir botão "Criar conta".

## Segurança

- `.env` está no `.gitignore` — NUNCA commitar credenciais reais.
- `.env.example` contém apenas placeholders `VITE_FIREBASE_*`.
- As 6 variáveis reais ficam só na Vercel (Production) e no `.env` local do Thiago.
- `firestore.rules` é público de propósito (política de acesso, não segredo).

## Fluxo de trabalho com o Thiago

O Thiago manda fotos/prints e pedidos em português; o trabalho é editar/adicionar
funcionalidades no sistema. Sempre: implementar → `npm run build` para validar →
commit com mensagem clara → push para a branch de trabalho (a Vercel publica sozinha).
Responder em português.
