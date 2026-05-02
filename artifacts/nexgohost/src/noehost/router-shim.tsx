import React from 'react';
import { Link as WouterLink, useLocation as useWouterLocation, Redirect } from 'wouter';

export { WouterLink as Link };

export function useLocation() {
  const [pathname] = useWouterLocation();
  return {
    pathname,
    search: window.location.search,
    hash: window.location.hash,
    state: null,
    key: pathname,
  };
}

export function useNavigate() {
  const [, setLocation] = useWouterLocation();
  return (to: string, _opts?: any) => setLocation(to);
}

export function Navigate({ to, replace: _replace }: { to: string; replace?: boolean }) {
  return <Redirect to={to} />;
}

export function BrowserRouter({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function Routes({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function Route({ element }: { path?: string; element?: React.ReactNode }) {
  return <>{element}</>;
}

export function useParams() {
  return {};
}
