// src/app/routes/RouteGuards.tsx
import React from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../shared/ui/components/Button';
import { buildLoginUrl, ROUTES, sanitizeInternalRedirect } from './paths';

/**
 * Redirige enlaces legados de recuperación (`/?token=...`) hacia `/recuperar-contrasena?token=...`
 * antes de mostrar el portal público de agendamiento.
 */
export const PublicRootGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const token = searchParams.get('token');

  if (token && token.trim() !== '') {
    return <Navigate to={`${ROUTES.RECOVERY}${location.search}`} replace />;
  }

  return <>{children}</>;
};

export const GuestOnlyLogin: React.FC<{
  isAuthenticated: boolean;
  defaultInternalRoute: string;
  children: React.ReactNode;
}> = ({ isAuthenticated, defaultInternalRoute, children }) => {
  const [searchParams] = useSearchParams();
  const location = useLocation();

  // Si un enlace con token llegara a /login?token=..., redirige de inmediato al flujo de recuperación
  const token = searchParams.get('token');
  if (token && token.trim() !== '') {
    return <Navigate to={`${ROUTES.RECOVERY}${location.search}`} replace />;
  }

  if (isAuthenticated) {
    const safeRedirect = sanitizeInternalRedirect(searchParams.get('redirect'));
    return <Navigate to={safeRedirect ?? defaultInternalRoute} replace />;
  }

  return <>{children}</>;
};

export const RequireAuth: React.FC<{
  isAuthenticated: boolean;
  children: React.ReactNode;
}> = ({ isAuthenticated, children }) => {
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to={buildLoginUrl(`${location.pathname}${location.search}`)} replace />;
  }

  return <>{children}</>;
};

export const RequirePermission: React.FC<{
  allowed: boolean;
  title: string;
  message: string;
  fallbackRoute?: string;
  fallbackLabel?: string;
  children: React.ReactNode;
}> = ({
  allowed,
  title,
  message,
  fallbackRoute,
  fallbackLabel = 'Ir a mi módulo principal',
  children,
}) => {
  const navigate = useNavigate();

  if (!allowed) {
    return (
      <div className="p-6 sm:p-8">
        <div
          role="alert"
          className="mx-auto max-w-xl rounded-2xl border border-[#E2E6EA] border-t-4 border-t-[#D4AF37] bg-white p-8 text-center shadow-xs space-y-4"
        >
          <h2 className="text-xl font-extrabold text-[#1E242B]">{title}</h2>
          <p className="text-sm text-[#687380]">{message}</p>
          {fallbackRoute && (
            <div className="pt-2">
              <Button variant="outline" onClick={() => navigate(fallbackRoute)}>
                {fallbackLabel}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
