import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
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
