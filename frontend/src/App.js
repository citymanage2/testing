import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import TaskCreate from './pages/TaskCreate';
import TaskStatus from './pages/TaskStatus';
import EstimateView from './pages/EstimateView';
import Admin from './pages/Admin';
export default function App() {
    return (_jsx(BrowserRouter, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(Login, {}) }), _jsx(Route, { element: _jsx(ProtectedRoute, {}), children: _jsxs(Route, { element: _jsx(Layout, {}), children: [_jsx(Route, { path: "/", element: _jsx(Navigate, { to: "/task/create", replace: true }) }), _jsx(Route, { path: "/task/create", element: _jsx(TaskCreate, {}) }), _jsx(Route, { path: "/task/:id/status", element: _jsx(TaskStatus, {}) }), _jsx(Route, { path: "/task/:id/estimate", element: _jsx(EstimateView, {}) })] }) }), _jsx(Route, { element: _jsx(ProtectedRoute, { adminOnly: true }), children: _jsx(Route, { element: _jsx(Layout, {}), children: _jsx(Route, { path: "/admin", element: _jsx(Admin, {}) }) }) })] }) }));
}
