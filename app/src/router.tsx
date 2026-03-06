import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { AdminLayout } from './components/layout/AdminLayout';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { LoginPage } from './pages/auth/LoginPage';
import { HomePage } from './pages/checklist/HomePage';
import { NewChecklistPage } from './pages/checklist/NewChecklistPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminSubmissions } from './pages/admin/AdminSubmissions';
import { AdminChecklists } from './pages/admin/AdminChecklists';
import { AdminUsers } from './pages/admin/AdminUsers';
import { AdminSessions } from './pages/admin/AdminSessions';

export const router = createBrowserRouter([
  // Public routes
  {
    path: '/login',
    element: <LoginPage />,
  },

  // Site manager routes
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'checklist/new',
        element: <NewChecklistPage />,
      },
      // Future: checklist/:id for viewing/editing drafts
    ],
  },

  // Admin routes
  {
    path: '/admin',
    element: (
      <ProtectedRoute requiredRole="admin">
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <AdminDashboard />,
      },
      {
        path: 'submissions',
        element: <AdminSubmissions />,
      },
      {
        path: 'checklists',
        element: <AdminChecklists />,
      },
      {
        path: 'users',
        element: <AdminUsers />,
      },
      {
        path: 'sessions',
        element: <AdminSessions />,
      },
    ],
  },
]);
