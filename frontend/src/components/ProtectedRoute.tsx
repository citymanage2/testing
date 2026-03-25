import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

interface Props {
  adminOnly?: boolean;
}

export default function ProtectedRoute({ adminOnly = false }: Props) {
  const { token, role } = useAuthStore();

  if (!token) return <Navigate to="/login" replace />;
  if (adminOnly && role !== 'admin') return <Navigate to="/task/create" replace />;

  return <Outlet />;
}
