# 🖨️ Gestão 3D — Sistema de Projetos e Produção para Impressão 3D

Sistema web completo para gerenciar uma operação de impressão 3D do começo ao fim:
**orçamento → aprovação → fila → impressão → pós-processo → entrega**, com controle
de estoque por bobina, custo real por grama, suporte a multicolorido/multimaterial
(AMS da Bambu Lab A1 Combo), financeiro, manutenção preventiva e relatórios.

**Stack:** React 18 + Vite • Firebase Authentication • Cloud Firestore • Tailwind CSS • Recharts • jsPDF • SheetJS • Deploy na Vercel.

---

## Índice

1. [Funcionalidades por módulo](#1-funcionalidades-por-módulo)
2. [Estrutura de pastas e arquivos](#2-estrutura-de-pastas-e-arquivos)
3. [Mapa de páginas e componentes](#3-mapa-de-páginas-e-componentes)
4. [Modelagem do Firestore](#4-modelagem-do-firestore)
5. [Fluxo de uso do sistema](#5-fluxo-de-uso-do-sistema)
6. [Regras de negócio implementadas](#6-regras-de-negócio-implementadas)
7. [Instalação passo a passo](#7-instalação-passo-a-passo)
8. [Deploy na Vercel](#8-deploy-na-vercel)
9. [Sugestões de melhorias futuras](#9-sugestões-de-melhorias-futuras)

---

## 1. Funcionalidades por módulo

| # | Módulo | O que faz |
|---|--------|-----------|
| 1 | **Dashboard** | Gasto em filamento, faturamento, lucro bruto, peças produzidas, projetos em andamento, impressões ok/falhas, alertas de estoque (com aviso especial quando a bobina está alocada em projeto futuro), próximas manutenções, gráficos de custos × receitas × lucro, despesas por categoria e consumo de filamento g/mês. |
| 2 | **Impressoras** | Cadastro com valor, vida útil e **custo/hora automático** (valor ÷ vida útil). Horas de uso somadas automaticamente a cada impressão concluída (e a cada falha). Status ativa/manutenção/parada. Pronto para múltiplas impressoras. |
| 3 | **Filamentos & Estoque** | Bobinas com marca, material (20 pré-cadastrados + personalizados), cor com seletor visual, acabamento, diâmetro, pesos, preço e **custo/g automático**. Status automático (Disponível/Em uso/Acabando/Esgotada), limite de alerta por bobina, "Pedido feito" para silenciar alerta, histórico de reposições, histórico de consumo por projeto, ajuste de peso por pesagem. Aba de insumos de embalagem com estoque mínimo. |
| 4 | **Projetos** | Cliente ou uso interno, categoria, prioridade, 10 status, prazo, tags coloridas, links STL/3MF/MakerWorld/Printables, imagens. **Kits**: várias partes (plates), cada uma com seus slots de AMS, tempo e custo — custo consolidado no projeto. Duplicar projeto e salvar/usar templates. |
| 5 | **Orçamento & Precificação** | Por slot do AMS: bobina (busca por material/cor/marca), gramas da peça e **purga separada** — custo por bobina específica. Energia (horas × W × tarifa), hora-máquina, mão de obra (hora ou fixo), acabamento, embalagem, frete. Margens distintas para venda/revenda/atacado, preço promocional, preço manual, **histórico de preços com motivo**, congelamento de estimativa e comparação estimado × real. |
| 6 | **Produção & Fila** | Fila ordenada por prioridade + prazo com etapas pendente → fatiar → pronto → imprimindo → pós → concluído. Iniciar com **checklist pré-impressão**, concluir com **checklist pós** + tempo real → desconta gramas das bobinas e soma horas na impressora. Falha com motivo, filamento perdido por slot, tempo perdido, **custo da falha automático** e reimpressão. Campos do Bambu Studio: arquivo 3MF, perfil, camada, infill, paredes, temperaturas, trocas de filamento. |
| 7 | **Pós-processamento** | Etapas (suportes, lixamento, pintura...) com tempo e custo, observações, fotos da peça, avaliação de qualidade. Total consolidado no orçamento. |
| 8 | **Clientes & Pedidos** | Clientes com WhatsApp/Instagram, histórico e total comprado. Pedidos numerados (PED-ANO-###) com projetos incluídos (preço sugerido automático), desconto, forma/status de pagamento e entrega. "Marcar pago" lança receita. |
| 9 | **Financeiro** | Despesas por categoria e receitas (muitas automáticas: compra de bobina, manutenção, pedido pago). Lucro por projeto estimado × real, filtro por mês, **exportação PDF e Excel**. |
| 10 | **Manutenção** | Agenda preventiva por horas de uso (limpeza de bico, lubrificação, calibração, nozzle, AMS, placa — intervalos editáveis), aviso ao se aproximar/vencer, registro de manutenções (atualiza agenda + lança despesa), falhas recorrentes por impressora, estoque de peças de reposição. |
| 11 | **Biblioteca** | Perfis de impressão (aplicáveis às partes com 1 clique), materiais com propriedades (temperaturas, velocidade, características), fornecedores com avaliação e prazo, templates de projeto. |
| 12 | **Relatórios** | Peças mais lucrativas, materiais mais usados, falhas por tipo/impressora, consumo por período, **custo médio por hora de impressão**, desperdício (purga + falhas), estimado × real. Exportação PDF e Excel. |
| 13 | **Configurações** | Nome do negócio, tarifa kWh, consumo padrão (400 W), margens padrão, mão de obra/h, limite de alerta padrão, materiais e marcas personalizados, checklists editáveis, **backup JSON completo**, log de alterações (300 últimas). |

Extras: busca global, filtros e ordenação em todas as listas, dark mode padrão (com tema claro), peças de teste/calibração fora das métricas de venda, responsivo desktop/celular.

---

## 2. Estrutura de pastas e arquivos

```
gestao-impressora/
├── index.html                  # HTML raiz (dark mode padrão, fonte Inter)
├── package.json                # Dependências e scripts
├── vite.config.js              # Vite + divisão de chunks (firebase/charts/export)
├── tailwind.config.js          # Tailwind (darkMode: 'class')
├── postcss.config.js
├── vercel.json                 # Rewrite SPA para a Vercel
├── firestore.rules             # Regras de segurança (dados por usuário)
├── .env.example                # Modelo das variáveis do Firebase
├── public/
│   └── favicon.svg
└── src/
    ├── main.jsx                # Bootstrap: Router + Providers
    ├── App.jsx                 # Rotas protegidas por autenticação
    ├── index.css               # Design system (Tailwind @layer components)
    ├── firebase.js             # Inicialização Firebase (Auth + Firestore)
    ├── contexts/
    │   ├── AuthContext.jsx     # Login/registro/reset + seed inicial
    │   ├── DataContext.jsx     # Assina TODAS as coleções em tempo real
    │   ├── ThemeContext.jsx    # Dark/light persistido
    │   └── ToastContext.jsx    # Notificações
    ├── lib/
    │   ├── constants.js        # Materiais, marcas, status, motivos de falha...
    │   ├── calculations.js     # TODAS as regras de custo/preço/alertas
    │   ├── ops.js              # Operações de domínio (concluir impressão,
    │   │                       #  falha, reposição, pagar pedido...) em batch
    │   ├── db.js               # CRUD genérico + log de alterações
    │   ├── seed.js             # Seed do 1º login (configurações + materiais)
    │   ├── format.js           # R$, gramas, datas, durações hh:mm
    │   └── export.js           # PDF (jsPDF), Excel (SheetJS), backup JSON
    ├── components/
    │   ├── layout/
    │   │   ├── Layout.jsx      # Shell: sidebar + topbar + conteúdo
    │   │   ├── Sidebar.jsx     # Menu lateral fixo (drawer no celular)
    │   │   └── GlobalSearch.jsx# Busca global multi-coleção
    │   ├── ui/
    │   │   ├── DataTable.jsx   # Tabela com busca, filtros e ordenação
    │   │   ├── Modal.jsx, ConfirmDialog.jsx, Tabs.jsx
    │   │   ├── Field.jsx       # Input/Select/Textarea/ColorField/Checkbox
    │   │   ├── SearchSelect.jsx# Seletor com busca (bobinas, clientes...)
    │   │   ├── Badge.jsx       # Badges de status + bolinha de cor
    │   │   ├── StatCard.jsx, EmptyState.jsx
    │   └── domain/
    │       └── SlotEditor.jsx  # Editor dos slots do AMS (bobina+peça+purga)
    └── pages/
        ├── Login.jsx           ├── Dashboard.jsx      ├── Printers.jsx
        ├── Filaments.jsx       ├── Projects.jsx       ├── ProjectDetail.jsx
        ├── Production.jsx      ├── Clients.jsx        ├── Orders.jsx
        ├── Finance.jsx         ├── Maintenance.jsx    ├── Library.jsx
        ├── Reports.jsx         └── Settings.jsx
```

---

## 3. Mapa de páginas e componentes

| Rota | Página | Principais componentes/recursos |
|------|--------|--------------------------------|
| `/login` | Login | Entrar, criar conta, redefinir senha |
| `/` | Dashboard | StatCards, alertas, BarChart/PieChart/LineChart |
| `/impressoras` | Impressoras | Cards com barra de vida útil, modal CRUD |
| `/filamentos` | Filamentos | DataTable, abas Bobinas/Insumos, modais: bobina, histórico, reposição, ajuste de peso |
| `/projetos` | Projetos | DataTable com filtros, novo projeto, templates |
| `/projetos/:id` | Detalhe do projeto | Abas **Resumo / Partes & AMS (SlotEditor) / Orçamento / Produção / Pós-processo** |
| `/producao` | Produção | Fila ordenada, modais Iniciar (checklist), Concluir (desconto de bobinas), Falha (custo automático) |
| `/clientes` | Clientes | DataTable, detalhe com histórico de pedidos |
| `/pedidos` | Pedidos | DataTable, editor de itens com preço sugerido, "marcar pago" |
| `/financeiro` | Financeiro | StatCards, lançamentos, lucro por projeto, export PDF/Excel |
| `/manutencao` | Manutenção | Abas Agenda/Histórico/Peças/Falhas, modais registrar/intervalos |
| `/biblioteca` | Biblioteca | Abas Perfis/Materiais/Fornecedores/Templates |
| `/relatorios` | Relatórios | Filtro de período, 6 análises, export PDF/Excel |
| `/configuracoes` | Configurações | Abas Geral/Listas/Checklists/Backup/Log |

---

## 4. Modelagem do Firestore

Todos os dados ficam sob o documento do usuário — simples, seguro e sem necessidade
de índices compostos (as listas são assinadas em tempo real e filtradas no cliente):

```
users/{uid}                          ← documento de CONFIGURAÇÕES
│  businessName, energyTariff (R$/kWh), printerWattsDefault (W),
│  margins {sale, resale, wholesale} (%), laborRate (R$/h),
│  lowStockDefault (g), customMaterials[], customBrands[],
│  preChecklist[], postChecklist[], seeded, createdAt, updatedAt
│
├── printers/{id}
│     name, model, serial, purchaseDate, purchasePrice, lifespanHours,
│     hoursUsed (soma automática), watts|null, status: ativa|manutencao|parada,
│     notes, schedules: [{id, type, intervalHours, lastDoneHours, lastDoneDate}]
│
├── spools/{id}                      ← bobinas
│     brand, material, colorName, colorHex, finish, diameter: '1.75'|'2.85',
│     initialWeight, currentWeight (desconto automático), price,
│     supplier, purchaseDate, batch, location, alertThreshold,
│     reorderPlaced (silencia alerta), notes, expenseLogged,
│     usageHistory: [{id, date, type: uso|falha|ajuste, projectId, projectName,
│                     partName, grams, cost, remainingAfter}],
│     restocks: [{id, date, grams, price, supplier}]
│     → custo/g, status (disponivel|em_uso|acabando|esgotada) e alocações
│       são CALCULADOS (lib/calculations.js), nunca gravados desatualizados
│
├── projects/{id}
│     name, clientId, category, priority, status (10 etapas), isTest,
│     description, scale, deadline, tags[{label,color}], files[{label,url}],
│     images[], notes, quality, photos[], completedAt,
│     parts: [{ id, name, quantity, printerId, estMinutes, realMinutes,
│               slots: [{slot:1..4, spoolId, gramsPiece, gramsPurge}],
│               sliceData: {fileName, profileName, layerHeight, infill, walls,
│                           nozzleTemp, bedTemp, filamentChanges},
│               prodStatus: pendente|fatiar|pronto|imprimindo|pos|concluido,
│               attempts, startedAt, finishedAt, consumed }],
│     failures: [{ id, date, partId, partName, printerId, reason, reasonNote,
│                  lostMinutes, lostPerSlot[{slot,spoolId,grams}], cost, reprint }],
│     budget: { laborMode: hourly|fixed, laborHours, laborFixed,
│               finishing[{desc,value}], packagingCost, shippingCost,
│               margins{sale,resale,wholesale}, promoDiscount, manualPrice,
│               priceHistory[{date,price,reason}],
│               estimateSnapshot{at, filament, energy, machine, ..., total} },
│     postSteps: [{id, name, minutes, cost, notes, done}]
│
├── clients/{id}        name, phone, whatsapp, instagram, email, address, notes
├── orders/{id}         number (PED-ANO-###), clientId, deliveryDate,
│                       items[{projectId, description, qty, unitPrice}],
│                       discount, paymentMethod, paymentStatus, status,
│                       notes, revenueLogged
├── transactions/{id}   type: despesa|receita, category, description, value,
│                       date, orderId?, printerId?, auto (lançamento automático)
├── maintenanceRecords/{id}  printerId, type, date, hoursAtMaintenance,
│                            partReplaced, cost, notes
├── maintenanceParts/{id}    name, code, quantity, minQuantity, cost, supplier, notes
├── profiles/{id}       name, material, layerHeight, infill, walls,
│                       nozzleTemp, bedTemp, speed, notes
├── materials/{id}      name, nozzleMin/Max, bedMin/Max, speedMax, traits, builtin
│                       (20 materiais semeados no 1º login, todos editáveis)
├── suppliers/{id}      name, site, phone, deliveryDays, rating(1-5), notes
├── templates/{id}      name, data (projeto completo com produção zerada)
├── packagingItems/{id} name, quantity, minQuantity, unitCost, supplier, notes
└── activityLog/{id}    at, action, entity, label, detail   ← log de alterações
```

**Datas:** campos de topo usam `serverTimestamp`; datas dentro de arrays usam string
ISO (limitação do Firestore) — a formatação trata os dois casos.

**Segurança (`firestore.rules`):** cada usuário só lê/escreve em `users/{seu-uid}/**`.

---

## 5. Fluxo de uso do sistema

```
 1. CONFIGURAR   Configurações → tarifa kWh, consumo W, margens, mão de obra
 2. CADASTRAR    Impressoras (A1 Combo: valor + vida útil → custo/hora)
                 Filamentos (bobinas → custo/g + despesa automática)
 3. ORÇAR        Projetos → Novo → aba "Partes & AMS": para cada plate,
                 escolha a bobina de cada slot e cole gramas/purga/tempo
                 do Bambu Studio → aba "Orçamento": margens e preço final
 4. APROVAR      Status → "Na fila" (estimativa é congelada p/ comparação)
 5. PRODUZIR     Produção → Avançar → Iniciar (checklist pré) →
                 Concluir (tempo real; desconta bobinas, soma horas) OU
                 Falhou (motivo, gramas perdidas/slot, custo automático)
 6. FINALIZAR    Pós-processo: etapas + fotos + qualidade → status Concluído
 7. VENDER       Pedidos → itens com preço sugerido → Marcar pago (receita)
 8. ACOMPANHAR   Dashboard (alertas de estoque/manutenção) • Financeiro •
                 Relatórios (lucratividade, falhas, desperdício) • Manutenção
```

---

## 6. Regras de negócio implementadas

- **Custo/g** = preço pago ÷ peso original da bobina (sempre).
- **Custo de filamento do projeto** = Σ por slot usado: (g peça + g purga) × custo/g
  **da bobina específica daquele slot** — purga exibida separada no orçamento.
- **Energia** = horas × (W ÷ 1000) × tarifa kWh. **Hora-máquina** = horas × (valor ÷ vida útil).
- **Preço sugerido** = custo total ÷ (1 − margem%) — margens distintas para
  venda/revenda/atacado; preço manual sobrescreve; promocional aplica % sobre o final.
- **Concluir impressão** desconta automaticamente as gramas de cada bobina usada
  (com histórico por bobina: data, projeto, gramas, custo, restante) e soma horas na impressora — em **batch atômico**.
- **Falha** desconta material perdido, calcula custo (material + energia + máquina do tempo perdido), incrementa tentativas e pode recolocar na fila.
- **Bobina "Acabando"** abaixo do limite → alerta no Dashboard; se estiver alocada
  em projeto futuro (aguardando/fila/fatiando/imprimindo/pós), o alerta avisa:
  *"a bobina X está acabando e está alocada no projeto Y"*. "Pedido feito" silencia.
- **Peças de teste/calibração** (flag ou categoria) ficam fora de peças produzidas, lucratividade e sugestão de pedido.
- **Kits**: o custo do projeto é a soma das partes; cada parte tem produção independente.
- Compra de bobina, reposição, manutenção com custo e pedido pago geram lançamentos automáticos no Financeiro (marcados como `auto`).

---

## 7. Instalação passo a passo

### 7.1 Pré-requisitos

- **Node.js 18+** (recomendado 20/22): https://nodejs.org
- Conta Google para o **Firebase** (plano gratuito Spark é suficiente)

### 7.2 Criar o projeto no Firebase

1. Acesse https://console.firebase.google.com → **Adicionar projeto** (ex: `gestao-3d`). Google Analytics é opcional.
2. **Authentication** → *Get started* → aba **Sign-in method** → habilite **E-mail/senha**.
3. **Firestore Database** → *Criar banco de dados* → **modo de produção** → escolha a região (ex: `southamerica-east1` São Paulo).
4. Na aba **Regras** do Firestore, cole o conteúdo do arquivo [`firestore.rules`](./firestore.rules) e clique em **Publicar**.
5. **Configurações do projeto (engrenagem) → Seus apps → ícone Web `</>`** → registre o app (ex: `gestao-3d-web`, sem Hosting) → copie o objeto `firebaseConfig`.

### 7.3 Rodar localmente

```bash
# 1. Clone o repositório
git clone https://github.com/ThiagoFerreirared/gestao-impressora.git
cd gestao-impressora

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com os valores do firebaseConfig copiado no passo 7.2.5

# 4. Inicie em modo desenvolvimento
npm run dev
# → http://localhost:5173
```

Conteúdo do `.env` (exemplo):

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=gestao-3d.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=gestao-3d
VITE_FIREBASE_STORAGE_BUCKET=gestao-3d.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abc123def456
```

5. Abra o sistema, clique em **Criar conta** e pronto: no primeiro login o sistema
   cria as configurações padrão e semeia a biblioteca com os 20 materiais.

```bash
# Build de produção (opcional, para conferir)
npm run build && npm run preview
```

---

## 8. Deploy na Vercel

### Opção A — pelo site (recomendado)

1. Suba o repositório para o GitHub (já está, se você clonou deste repo).
2. Acesse https://vercel.com → login com GitHub → **Add New… → Project** → importe `gestao-impressora`.
3. A Vercel detecta **Vite** sozinha (Build `npm run build`, Output `dist`). Não mude nada.
4. Em **Environment Variables**, adicione as 6 variáveis `VITE_FIREBASE_*` com os mesmos valores do seu `.env` (marque Production + Preview).
5. **Deploy**. Em ~1 minuto você recebe a URL (ex: `https://gestao-impressora.vercel.app`).
6. **Importante:** no Firebase Console → **Authentication → Settings → Domínios autorizados** → **Adicionar domínio** → cole o domínio da Vercel (sem `https://`). Sem isso o login é bloqueado.

O arquivo [`vercel.json`](./vercel.json) já cuida do rewrite de SPA (atualizar a página em `/projetos/abc` não dá 404).

### Opção B — pela CLI

```bash
npm i -g vercel
vercel login
vercel            # primeiro deploy (aceite os padrões)
# cadastre as variáveis:
vercel env add VITE_FIREBASE_API_KEY        # (repita para as 6)
vercel --prod     # deploy de produção
```

Cada `git push` na branch principal gera deploy automático.

---

## 9. Sugestões de melhorias futuras

**Integração e automação**
- Importar o `.3mf`/G-code do Bambu Studio e preencher gramas/slot, tempo e perfil automaticamente (o 3MF é um ZIP com metadados de fatiamento).
- Integração MQTT com a A1 (modo LAN) para iniciar/encerrar registros sozinha e capturar tempo real e progresso.
- Leitura de etiqueta RFID/QR nas bobinas para seleção rápida no celular.

**Produto**
- Upload de fotos direto no Firebase Storage (hoje usa URLs).
- Catálogo público de peças com link de orçamento para o cliente aprovar online.
- Notificações push/WhatsApp (ex: bobina acabou, manutenção venceu, pedido pronto).
- Multiusuário por operação (funcionários com papéis) e auditoria por usuário.
- Kanban arrastável na fila de produção; agenda/calendário de entregas.
- Importação do backup JSON (restore) e sincronização com planilha Google.
- PWA offline-first (Firestore já tem cache offline — falta manifest + service worker).

**Financeiro**
- Precificação com impostos/taxas de marketplace (Shopee, Elo7, ML).
- Fluxo de caixa projetado e contas a pagar/receber com vencimentos.
- Curva ABC de clientes e produtos.

---

### Scripts disponíveis

| Comando | Ação |
|---------|------|
| `npm run dev` | Ambiente de desenvolvimento (hot reload) |
| `npm run build` | Build de produção em `dist/` |
| `npm run preview` | Serve o build localmente |

*Feito para operação real com Bambu Lab A1 Combo + AMS — mas funciona para qualquer impressora FDM.*
