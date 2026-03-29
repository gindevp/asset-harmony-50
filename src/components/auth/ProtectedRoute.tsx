import { Navigate, useLocation } from 'react-router-dom';
import { getStoredToken } from '@/api/http';
import { hasAnyAuthority } from '@/auth/jwt';

type Props = {
  children: React.ReactNode;
  /** Bất kỳ authority nào trong danh sách (ROLE_*) */
  anyAuthority?: string[];
};

export const ProtectedRoute = ({ children, anyAuthority }: Props) => {
  const location = useLocation();
  const token = getStoredToken();
  if (!token) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (anyAuthority?.length && !hasAnyAuthority(token, anyAuthority)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};
