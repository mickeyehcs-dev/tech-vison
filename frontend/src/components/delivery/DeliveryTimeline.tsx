import React from 'react';
import { Delivery } from '../../types';
import { formatDate } from '../../utils/formatters';
import { CheckCircle2, Clock, Truck, Package, ShieldCheck } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface DeliveryTimelineProps {
  delivery: Delivery;
  className?: string;
}

export const DeliveryTimeline: React.FC<DeliveryTimelineProps> = ({ delivery, className }) => {
  const steps = [
    {
      title: 'Created',
      timestamp: delivery.created_at,
      completed: true,
      icon: <Package className="w-4 h-4" />
    },
    {
      title: 'Assigned',
      timestamp: delivery.assigned_at,
      completed: Boolean(delivery.assigned_at),
      icon: <ShieldCheck className="w-4 h-4" />
    },
    {
      title: 'Accepted',
      timestamp: delivery.accepted_at,
      completed: Boolean(delivery.accepted_at),
      icon: <CheckCircle2 className="w-4 h-4" />
    },
    {
      title: 'In Transit',
      timestamp: delivery.started_at,
      completed: Boolean(delivery.started_at),
      icon: <Truck className="w-4 h-4" />
    },
    {
      title: 'Completed',
      timestamp: delivery.completed_at,
      completed: Boolean(delivery.completed_at),
      icon: <CheckCircle2 className="w-4 h-4" />
    }
  ];

  return (
    <div className={cn('p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs', className)}>
      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-6">
        Lifecycle Timeline
      </h4>
      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
        {steps.map((step, idx) => (
          <div key={idx} className="relative flex items-start justify-between gap-4">
            <div
              className={cn(
                'absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center border text-[10px]',
                step.completed
                  ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs'
                  : 'bg-white border-slate-300 text-slate-400'
              )}
            >
              {step.completed ? '✓' : idx + 1}
            </div>

            <div>
              <p
                className={cn(
                  'text-xs font-bold',
                  step.completed ? 'text-slate-900' : 'text-slate-400'
                )}
              >
                {step.title}
              </p>
              {step.timestamp ? (
                <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 font-medium">
                  <Clock className="w-3 h-3 text-slate-400" />
                  {formatDate(step.timestamp)}
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 mt-0.5 italic">Pending</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
