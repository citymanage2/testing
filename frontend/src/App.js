import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import Ks2Preview from './pages/Ks2Preview';
export default function App() {
    return (_jsx(BrowserRouter, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(Login, {}) }), _jsxs(Route, { element: _jsx(ProtectedRoute, {}), children: [_jsx(Route, { path: "/ks2-preview/:taskId/:accId", element: _jsx(Ks2Preview, {}) }), _jsxs(Route, { element: _jsx(Layout, {}), children: [_jsx(Route, { path: "/", element: _jsx(Navigate, { to: "/task/create", replace: true }) }), _jsx(Route, { path: "/task/create", element: _jsx(TaskCreate, {}) }), _jsx(Route, { path: "/task/:id/status", element: _jsx(TaskStatus, {}) }), _jsx(Route, { path: "/task/:id/estimate", element: _jsx(EstimateView, {}) }), _jsx(Route, { path: "/catalog", element: _jsx(Catalog, {}) }), _jsx(Route, { path: "/contractors", element: _jsx(Contractors, {}) }), _jsx(Route, { path: "/calculator", element: _jsx(RoomCalculator, {}) }), _jsx(Route, { path: "/settings/company", element: _jsx(CompanySettings, {}) }), _jsx(Route, { path: "/projects/:id", element: _jsx(ProjectDetail, {}) })] })] }), _jsx(Route, { element: _jsx(ProtectedRoute, { adminOnly: true }), children: _jsx(Route, { element: _jsx(Layout, {}), children: _jsx(Route, { path: "/admin", element: _jsx(Admin, {}) }) }) })] }) }));
}
