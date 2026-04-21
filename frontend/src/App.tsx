import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import TooltipProvider from './components/TooltipProvider';
import Layout from './components/Layout';
import Login from './pages/Login';
import TaskCreate from './pages/TaskCreate';
import TaskStatus from './pages/TaskStatus';
import EstimateView from './pages/EstimateView';
import Admin from './pages/Admin';
import CompanySettings from './pages/CompanySettings';
import Contractors from './pages/Contractors';
import Catalog from './pages/Catalog';
import RoomCalculator from './pages/RoomCalculator';
import ProjectDetail from './pages/ProjectDetail';
import Ks2Preview from './pages/Ks2Preview';
// v2 pages
import EstimatesV2 from './pages/v2/EstimatesV2';
import EstimateDetailV2 from './pages/v2/EstimateDetailV2';
import CatalogV2 from './pages/v2/CatalogV2';
import WorkStagesV2 from './pages/v2/WorkStagesV2';
import WarehouseV2 from './pages/v2/WarehouseV2';
import MaterialRequestsV2 from './pages/v2/MaterialRequestsV2';
import FinanceV2 from './pages/v2/FinanceV2';
import AssistantV2 from './pages/v2/AssistantV2';

export default function App() {
  return (
    <BrowserRouter>
      <TooltipProvider />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/ks2-preview/:taskId/:accId" element={<Ks2Preview />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/task/create" replace />} />
            <Route path="/task/create" element={<TaskCreate />} />
            <Route path="/task/:id/status" element={<TaskStatus />} />
            <Route path="/task/:id/estimate" element={<EstimateView />} />
            <Route path="/catalog" element={<Catalog />} />
            <Route path="/contractors" element={<Contractors />} />
            <Route path="/calculator" element={<RoomCalculator />} />
            <Route path="/settings/company" element={<CompanySettings />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            {/* v2 routes */}
            <Route path="/v2/estimates" element={<EstimatesV2 />} />
            <Route path="/v2/estimates/:id" element={<EstimateDetailV2 />} />
            <Route path="/v2/catalog" element={<CatalogV2 />} />
            <Route path="/v2/grp" element={<WorkStagesV2 />} />
            <Route path="/v2/warehouse" element={<WarehouseV2 />} />
            <Route path="/v2/material-requests" element={<MaterialRequestsV2 />} />
            <Route path="/v2/finance" element={<FinanceV2 />} />
            <Route path="/v2/assistant" element={<AssistantV2 />} />
          </Route>
        </Route>
        <Route element={<ProtectedRoute adminOnly />}>
          <Route element={<Layout />}>
            <Route path="/admin" element={<Admin />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
