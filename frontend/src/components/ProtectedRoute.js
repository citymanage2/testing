import { jsx as _jsx } from "react/jsx-runtime";
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
export default function ProtectedRoute({ adminOnly = false }) {
    const { token, role } = useAuthStore();
    if (!token)
        return _jsx(Navigate, { to: "/login", replace: true });
    if (adminOnly && role !== 'admin')
        return _jsx(Navigate, { to: "/task/create", replace: true });
    return _jsx(Outlet, {});
}
