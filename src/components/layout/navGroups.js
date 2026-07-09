import { LayoutDashboard, Printer, Store, Wallet, Settings } from 'lucide-react';

// Agrupamento usado na navegação mobile: abas fixas embaixo (estilo app de
// referência: Impressões / Filamentos / Vendas / Definições) + sub-abas em
// pílula para as páginas dentro de cada grupo. No desktop a Sidebar continua
// mostrando as 14 páginas direto, sem agrupar — isso aqui não altera as rotas,
// só a navegação visual no celular.
export const NAV_GROUPS = [
  {
    key: 'painel',
    label: 'Painel',
    icon: LayoutDashboard,
    items: [{ to: '/', label: 'Painel' }],
  },
  {
    key: 'producao',
    label: 'Produção',
    icon: Printer,
    items: [
      { to: '/impressoras', label: 'Impressoras' },
      { to: '/filamentos', label: 'Filamentos' },
      { to: '/projetos', label: 'Projetos' },
      { to: '/producao', label: 'Produção' },
      { to: '/manutencao', label: 'Manutenção' },
      { to: '/biblioteca', label: 'Biblioteca' },
    ],
  },
  {
    key: 'comercial',
    label: 'Vendas',
    icon: Store,
    items: [
      { to: '/clientes', label: 'Clientes' },
      { to: '/pedidos', label: 'Pedidos' },
      { to: '/produtos', label: 'Estoque' },
      { to: '/vendas', label: 'Vendas' },
    ],
  },
  {
    key: 'financeiro',
    label: 'Financeiro',
    icon: Wallet,
    items: [
      { to: '/financeiro', label: 'Financeiro' },
      { to: '/relatorios', label: 'Relatórios' },
    ],
  },
  {
    key: 'config',
    label: 'Definições',
    icon: Settings,
    items: [{ to: '/configuracoes', label: 'Definições' }],
  },
];

export function isInGroup(group, pathname) {
  return group.items.some((item) => {
    if (item.to === '/') return pathname === '/';
    return pathname === item.to || pathname.startsWith(`${item.to}/`);
  });
}

export function activeGroup(pathname) {
  return NAV_GROUPS.find((g) => isInGroup(g, pathname)) || NAV_GROUPS[0];
}
