import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { NotificationProvider } from './context/NotificationContext';
import { RoleGuard } from './components/layout/RoleGuard';

// Auth Pages
import { LoginPage } from './pages/auth/LoginPage';
import { OnboardingPage } from './pages/auth/OnboardingPage';

// Admin Pages
import { AdminOverview } from './pages/admin/AdminOverview';
import { AdminDeliveries } from './pages/admin/AdminDeliveries';
import { AdminUsers } from './pages/admin/AdminUsers';
import { AdminSensors } from './pages/admin/AdminSensors';
import { AdminSecurityLogs } from './pages/admin/AdminSecurityLogs';

// Sender Pages
import { SenderOverview } from './pages/sender/SenderOverview';
import { SenderCreateDelivery } from './pages/sender/SenderCreateDelivery';
import { SenderDeliveries } from './pages/sender/SenderDeliveries';

// Driver Pages
import { DriverOverview } from './pages/driver/DriverOverview';
import { DriverDeliveries } from './pages/driver/DriverDeliveries';
import { DriverActiveDelivery } from './pages/driver/DriverActiveDelivery';

// Common Pages
import { DeliveryDetailPage } from './pages/deliveries/DeliveryDetailPage';
import { NotificationsPage } from './pages/notifications/NotificationsPage';
import { ProfilePage } from './pages/profile/ProfilePage';
import { PublicTrackPage } from './pages/PublicTrackPage';
import { NotFoundPage } from './pages/NotFoundPage';

// Root Route Redirection
const RootRedirect: React.FC = () => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.first_login) return <Navigate to="/onboarding" replace />;

  if (user?.role === 'admin') return <Navigate to="/admin/overview" replace />;
  if (user?.role === 'sender') return <Navigate to="/sender/overview" replace />;
  if (user?.role === 'driver') return <Navigate to="/driver/overview" replace />;

  return <Navigate to="/login" replace />;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <NotificationProvider>
            <Routes>
              {/* Public Live Tracking & Auth Routes */}
              <Route path="/track/:code" element={<PublicTrackPage />} />
              <Route path="/track" element={<PublicTrackPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/onboarding"
                element={
                  <RoleGuard>
                    <OnboardingPage />
                  </RoleGuard>
                }
              />

              {/* Root redirect */}
              <Route path="/" element={<RootRedirect />} />

              {/* Common Authenticated Routes */}
              <Route
                path="/deliveries/:id"
                element={
                  <RoleGuard>
                    <DeliveryDetailPage />
                  </RoleGuard>
                }
              />
              <Route
                path="/notifications"
                element={
                  <RoleGuard>
                    <NotificationsPage />
                  </RoleGuard>
                }
              />
              <Route
                path="/profile"
                element={
                  <RoleGuard>
                    <ProfilePage />
                  </RoleGuard>
                }
              />

              {/* Admin Portal Routes */}
              <Route
                path="/admin/overview"
                element={
                  <RoleGuard allowedRoles={['admin']}>
                    <AdminOverview />
                  </RoleGuard>
                }
              />
              <Route
                path="/admin/deliveries"
                element={
                  <RoleGuard allowedRoles={['admin']}>
                    <AdminDeliveries />
                  </RoleGuard>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <RoleGuard allowedRoles={['admin']}>
                    <AdminUsers />
                  </RoleGuard>
                }
              />
              <Route
                path="/admin/sensors"
                element={
                  <RoleGuard allowedRoles={['admin']}>
                    <AdminSensors />
                  </RoleGuard>
                }
              />
              <Route
                path="/admin/security-logs"
                element={
                  <RoleGuard allowedRoles={['admin']}>
                    <AdminSecurityLogs />
                  </RoleGuard>
                }
              />

              {/* Sender Portal Routes */}
              <Route
                path="/sender/overview"
                element={
                  <RoleGuard allowedRoles={['sender']}>
                    <SenderOverview />
                  </RoleGuard>
                }
              />
              <Route
                path="/sender/create-delivery"
                element={
                  <RoleGuard allowedRoles={['sender']}>
                    <SenderCreateDelivery />
                  </RoleGuard>
                }
              />
              <Route
                path="/sender/deliveries"
                element={
                  <RoleGuard allowedRoles={['sender']}>
                    <SenderDeliveries />
                  </RoleGuard>
                }
              />

              {/* Driver Portal Routes */}
              <Route
                path="/driver/overview"
                element={
                  <RoleGuard allowedRoles={['driver']}>
                    <DriverOverview />
                  </RoleGuard>
                }
              />
              <Route
                path="/driver/deliveries"
                element={
                  <RoleGuard allowedRoles={['driver']}>
                    <DriverDeliveries />
                  </RoleGuard>
                }
              />
              <Route
                path="/driver/active"
                element={
                  <RoleGuard allowedRoles={['driver']}>
                    <DriverActiveDelivery />
                  </RoleGuard>
                }
              />

              {/* 404 Fallback */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </NotificationProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
};

export default App;
