import React from 'react';
import { Delivery } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { formatDate } from '../../utils/formatters';
import { MapPin, User, Cpu, ArrowRight, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';

export interface DeliveryCardProps {
  delivery: Delivery;
  className?: string;
}

export const DeliveryCard: React.FC<DeliveryCardProps> = ({ delivery, className }) => {
  return (
    <div
      className={cn(
        'bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs transition-all duration-200 hover:shadow-md hover:border-slate-300 flex flex-col justify-between',
        className
      )}
    >
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              #{delivery.delivery_code}
            </span>
            <h4 className="text-base font-bold text-slate-900 mt-1.5">{delivery.food_name}</h4>
          </div>
          <StatusBadge status={delivery.status} />
        </div>

        {/* Route Details */}
        <div className="flex flex-col gap-2 my-4 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
          <div className="flex items-start gap-2 text-slate-700">
            <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
            <span className="truncate">
              <strong className="text-slate-500 font-medium">From:</strong> {delivery.source_location}
            </span>
          </div>
          <div className="flex items-start gap-2 text-slate-700">
            <MapPin className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
            <span className="truncate">
              <strong className="text-slate-500 font-medium">To:</strong> {delivery.destination_location}
            </span>
          </div>
        </div>

        {/* Meta badges */}
        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 mb-4">
          <div className="flex items-center gap-1.5 truncate">
            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate font-medium">
              {delivery.driver_name
                ? `${delivery.driver_name} ${delivery.driver_phone ? `(${delivery.driver_phone})` : ''}`
                : 'Driver: Unassigned'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 truncate">
            <Cpu className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate font-medium">
              {delivery.device_id ? `IoT: ${delivery.device_id}` : 'IoT: Driver Module'}
            </span>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
          <Clock className="w-3 h-3" />
          <span>{formatDate(delivery.created_at)}</span>
        </div>
        <Link
          to={`/deliveries/${delivery.id}`}
          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors"
        >
          View Details
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};
