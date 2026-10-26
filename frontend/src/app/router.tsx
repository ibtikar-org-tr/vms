import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom'
import { lazyRoute } from './lazy-route'
import { RouteErrorBoundary } from '../components/errors/RouteErrorBoundary'
import { LegacyDashboardRedirect } from './LegacyDashboardRedirect'
import { dashboardRouteChildren } from './dashboard-routes'

const router = createBrowserRouter([
  {
    path: '/signup',
    errorElement: <RouteErrorBoundary />,
    hydrateFallbackElement: <div />,
    lazy: lazyRoute(() => import('../pages/SignupPage'), 'SignupPage'),
  },
  {
    path: '/verify-email',
    errorElement: <RouteErrorBoundary />,
    hydrateFallbackElement: <div />,
    lazy: lazyRoute(() => import('../pages/VerifyEmailPage'), 'VerifyEmailPage'),
  },
  {
    path: '/registration',
    errorElement: <RouteErrorBoundary />,
    hydrateFallbackElement: <div />,
    lazy: lazyRoute(() => import('../pages/RegistrationPage'), 'RegistrationPage'),
  },
  {
    path: '/login',
    errorElement: <RouteErrorBoundary />,
    hydrateFallbackElement: <div />,
    lazy: lazyRoute(() => import('../pages/LoginPage'), 'LoginPage'),
  },
  {
    path: '/iforgot',
    errorElement: <RouteErrorBoundary />,
    hydrateFallbackElement: <div />,
    lazy: lazyRoute(() => import('../pages/IForgotPage'), 'IForgotPage'),
  },
  {
    path: '/reset-password',
    errorElement: <RouteErrorBoundary />,
    hydrateFallbackElement: <div />,
    lazy: lazyRoute(() => import('../pages/ResetPasswordPage'), 'ResetPasswordPage'),
  },
  {
    path: '/telegram-bot',
    errorElement: <RouteErrorBoundary />,
    hydrateFallbackElement: <div />,
    lazy: lazyRoute(() => import('../pages/TelegramBotPage'), 'TelegramBotPage'),
  },
  {
    path: '/welcome',
    errorElement: <RouteErrorBoundary />,
    hydrateFallbackElement: <div />,
    lazy: lazyRoute(() => import('../pages/HomePage'), 'HomePage'),
  },
  {
    path: '/',
    errorElement: <RouteErrorBoundary />,
    hydrateFallbackElement: <div />,
    lazy: lazyRoute(() => import('../pages/DashboardPage'), 'DashboardPage'),
    children: dashboardRouteChildren,
  },
  {
    path: '/dashboard/*',
    hydrateFallbackElement: <div />,
    element: <LegacyDashboardRedirect />,
  },
  {
    path: '*',
    hydrateFallbackElement: <div />,
    element: <Navigate to="/" replace />,
  },
], {
  basename: import.meta.env.VITE_BASE_PATH === '/.' ? '/' : import.meta.env.VITE_BASE_PATH || '/mf/membership-app/',
})

export function AppRouter() {
  return <RouterProvider router={router} />
}
