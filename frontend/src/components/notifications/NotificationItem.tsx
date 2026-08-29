import React from 'react';
import { Notification } from '../../types';
import { formatRelativeTime } from '../../utils/formatters';
import { CheckCircle, Info, Truck, ShieldAlert } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface NotificationItemProps {
  notification: Notification;
  onMarkRead?: (id: number) => void;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onMarkRead
}) => {
  const getIcon = () => {
    switch (notification.type) {
      case 'SPOILAGE_ALERT':
        return <ShieldAlert className="w-4 h-4 text-rose-600" />;
      case 'DELIVERY_ASSIGNED':
      case 'DELIVERY_IN_TRANSIT':
        return <Truck className="w-4 h-4 text-blue-600" />;
      case 'DELIVERY_COMPLETED':
        return <CheckCircle className="w-4 h-4 text-emerald-600" />;
      default:
        return <Info className="w-4 h-4 text-blue-600" />;
    }
  };

  return (
    <div
      className={cn(
        'p-3.5 rounded-xl border transition-all duration-150 flex items-start gap-3',
        notification.is_read
          ? 'bg-slate-50 border-slate-200 opacity-75'
          : 'bg-white border-slate-200/90 shadow-xs'
      )}
    >
      <div className="p-2 rounded-lg bg-slate-100 shrink-0 mt-0.5">{getIcon()}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h5 className="text-xs font-bold text-slate-900 truncate">{notification.title}</h5>
          <span className="text-[10px] text-slate-400 whitespace-nowrap">
            {formatRelativeTime(notification.created_at)}
          </span>
        </div>
        <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{notification.message}</p>

        {!notification.is_read && onMarkRead && (
          <button
            onClick={() => onMarkRead(notification.id)}
            className="text-[10px] text-emerald-700 hover:text-emerald-800 font-bold mt-2 cursor-pointer"
          >
            Mark as read
          </button>
        )}
      </div>
    </div>
  );
};
