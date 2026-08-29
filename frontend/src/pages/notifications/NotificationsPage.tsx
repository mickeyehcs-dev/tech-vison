import React from 'react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { SectionCard } from '../../components/common/SectionCard';
import { NotificationItem } from '../../components/notifications/NotificationItem';
import { Button } from '../../components/common/Button';
import { EmptyState, LoadingState } from '../../components/common/EmptyState';
import { useNotifications } from '../../context/NotificationContext';
import { Bell, CheckCheck, RefreshCw } from 'lucide-react';

export const NotificationsPage: React.FC = () => {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, fetchNotifications } =
    useNotifications();

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 max-w-3xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Notification Center</h1>
            <p className="text-xs text-slate-500 mt-1">
              Real-time alerts, spoilage warnings, assignment notifications, and lifecycle milestones
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={fetchNotifications}
            >
              Refresh
            </Button>
            {unreadCount > 0 && (
              <Button
                size="sm"
                variant="primary"
                leftIcon={<CheckCheck className="w-4 h-4" />}
                onClick={markAllAsRead}
              >
                Mark All Read ({unreadCount})
              </Button>
            )}
          </div>
        </div>

        <SectionCard
          title={
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-emerald-600" />
                <span>All In-App Notifications</span>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {notifications.length} Total
              </span>
            </div>
          }
        >
          {loading && notifications.length === 0 ? (
            <LoadingState message="Loading notifications..." />
          ) : notifications.length === 0 ? (
            <EmptyState
              icon={<Bell className="w-8 h-8 text-slate-400" />}
              title="No Notifications"
              message="You are all caught up! New cargo warnings and assignments will appear here."
            />
          ) : (
            <div className="flex flex-col gap-2.5">
              {notifications.map((notif) => (
                <NotificationItem
                  key={notif.id}
                  notification={notif}
                  onMarkRead={(id) => markAsRead(id)}
                />
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </DashboardLayout>
  );
};
