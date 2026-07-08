import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Printers from './pages/Printers';
import Filaments from './pages/Filaments';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Production from './pages/Production';
import Clients from './pages/Clients';
import Orders from './pages/Orders';
import Products from './pages/Products';
import Sales from './pages/Sales';
import Finance from './pages/Finance';
import Maintenance from './pages/Maintenance';
import Library from './pages/Library';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

function Splash() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
    </div>
  );
}

export default function App() {
  const { user, initializing } = useAuth();

  if (initializing) return <Splash />;

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="/impressoras" element={<Printers />} />
        <Route path="/filamentos" element={<Filaments />} />
        <Route path="/projetos" element={<Projects />} />
        <Route path="/projetos/:id" element={<ProjectDetail />} />
        <Route path="/producao" element={<Production />} />
        <Route path="/clientes" element={<Clients />} />
        <Route path="/pedidos" element={<Orders />} />
        <Route path="/produtos" element={<Products />} />
        <Route path="/vendas" element={<Sales />} />
        <Route path="/financeiro" element={<Finance />} />
        <Route path="/manutencao" element={<Maintenance />} />
        <Route path="/biblioteca" element={<Library />} />
        <Route path="/relatorios" element={<Reports />} />
        <Route path="/configuracoes" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
