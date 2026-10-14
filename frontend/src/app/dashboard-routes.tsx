import { lazyRoute } from './lazy-route'
import type { RouteObject } from 'react-router-dom'

export const dashboardRouteChildren: RouteObject[] = [
  {
    index: true,
    hydrateFallbackElement: <div />,
    lazy: lazyRoute(() => import('../pages/dashboard/DashboardMainPage'), 'DashboardMainPage'),
  },
  {
    path: 'agenda',
    hydrateFallbackElement: <div />,
    lazy: lazyRoute(() => import('../pages/dashboard/DashboardAgendaPage'), 'DashboardAgendaPage'),
  },
  {
    path: 'profile',
    hydrateFallbackElement: <div />,
    lazy: lazyRoute(() => import('../pages/dashboard/DashboardProfilePage'), 'DashboardProfilePage'),
  },
  {
    path: 'community',
    hydrateFallbackElement: <div />,
    lazy: lazyRoute(() => import('../pages/dashboard/DashboardCommunityPage'), 'DashboardCommunityPage'),
  },
  {
    path: 'projects',
    hydrateFallbackElement: <div />,
    lazy: lazyRoute(() => import('../pages/dashboard/DashboardProjectsPage'), 'DashboardProjectsPage'),
  },
  {
    path: 'projects/:projectID/sub-projects',
    hydrateFallbackElement: <div />,
    lazy: lazyRoute(() => import('../pages/dashboard/DashboardProjectSubProjectsPage'), 'DashboardProjectSubProjectsPage'),
  },
  {
    path: 'projects/:projectID',
    hydrateFallbackElement: <div />,
    lazy: lazyRoute(() => import('../pages/dashboard/DashboardProjectDetailsPage'), 'DashboardProjectDetailsPage'),
  },
  {
    path: 'projects/:projectID/events',
    hydrateFallbackElement: <div />,
    lazy: lazyRoute(() => import('../pages/dashboard/DashboardProjectEventsPage'), 'DashboardProjectEventsPage'),
  },
  {
    path: 'projects/:projectID/clubs',
    hydrateFallbackElement: <div />,
    lazy: lazyRoute(() => import('../pages/dashboard/DashboardProjectClubsPage'), 'DashboardProjectClubsPage'),
  },
  {
    path: 'projects/:projectID/positions',
    hydrateFallbackElement: <div />,
    lazy: lazyRoute(() => import('../pages/dashboard/DashboardProjectPositionsPage'), 'DashboardProjectPositionsPage'),
  },
  {
    path: 'projects/:projectID/notes',
    hydrateFallbackElement: <div />,
    lazy: lazyRoute(() => import('../pages/dashboard/DashboardProjectNotesPage'), 'DashboardProjectNotesPage'),
  },
  {
    path: 'volunteering',
    hydrateFallbackElement: <div />,
    lazy: lazyRoute(() => import('../pages/dashboard/DashboardVolunteeringPage'), 'DashboardVolunteeringPage'),
  },
  {
    path: 'events',
    hydrateFallbackElement: <div />,
    lazy: lazyRoute(() => import('../pages/dashboard/DashboardEventsPage'), 'DashboardEventsPage'),
  },
  {
    path: 'clubs',
    hydrateFallbackElement: <div />,
    lazy: lazyRoute(() => import('../pages/dashboard/DashboardClubsPage'), 'DashboardClubsPage'),
  },
  {
    path: 'clubs/:clubID',
    hydrateFallbackElement: <div />,
    lazy: lazyRoute(() => import('../pages/dashboard/DashboardClubPage'), 'DashboardClubPage'),
  },
  {
    path: 'clubs/:clubID/edit',
    hydrateFallbackElement: <div />,
    lazy: lazyRoute(() => import('../pages/dashboard/DashboardClubDetailsPage'), 'DashboardClubDetailsPage'),
  },
  {
    path: 'event/:eventID/edit',
    hydrateFallbackElement: <div />,
    lazy: lazyRoute(() => import('../pages/dashboard/DashboardEventEditPage'), 'DashboardEventEditPage'),
  },
  {
    path: 'event/:eventID/admin',
    hydrateFallbackElement: <div />,
    lazy: lazyRoute(() => import('../pages/dashboard/DashboardEventAdminPage'), 'DashboardEventAdminPage'),
  },
  {
    path: 'events/:eventID',
    hydrateFallbackElement: <div />,
    lazy: lazyRoute(() => import('../pages/dashboard/DashboardEventDetailsPage'), 'DashboardEventDetailsPage'),
  },
  {
    path: 'event/:eventID',
    hydrateFallbackElement: <div />,
    lazy: lazyRoute(() => import('../pages/dashboard/DashboardEventDetailsPage'), 'DashboardEventDetailsPage'),
  },
  {
    path: 'positions/:positionID/edit',
    hydrateFallbackElement: <div />,
    lazy: lazyRoute(() => import('../pages/dashboard/DashboardPositionEditPage'), 'DashboardPositionEditPage'),
  },
] 
