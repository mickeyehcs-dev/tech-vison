import React from 'react';
import { Delivery } from '../../types';
import { DataTable, Column } from '../common/DataTable';
import { StatusBadge } from '../common/StatusBadge';
import { formatDate } from '../../utils/formatters';
import { useNavigate } from 'react-router-dom';
import { Button } from '../common/Button';
import { ArrowRight, UserCheck } from 'lucide-react';

export interface DeliveryTableProps {
  deliveries: Delivery[];
  loading?: boolean;
  onAssignClick?: (delivery: Delivery) => void;
  isAdmin?: boolean;
}

export const DeliveryTable: React.FC<DeliveryTableProps> = ({
  deliveries,
  loading = false,
  onAssignClick,
  isAdmin = false
}) => {
  const navigate = useNavigate();

  const columns: Column<Delivery>[] = [
    {
      header: 'Delivery Code',
      accessor: (d) => (
        <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
          #{d.delivery_code}
        </span>
      )
    },
    {
      header: 'Food Item',
      accessor: (d) => <span className="font-bold text-slate-900">{d.food_name}</span>
    },
    {
      header: 'Route',
      accessor: (d) => (
        <div className="text-xs max-w-[200px] truncate">
          <span className="text-slate-600">{d.source_location}</span>
          <span className="text-slate-400 mx-1">→</span>
          <span className="text-slate-900 font-medium">{d.destination_location}</span>
        </div>
      )
    },
    {
      header: 'Status',
      accessor: (d) => <StatusBadge status={d.status} />
    },
    {
      header: 'Driver Info',
      accessor: (d) => (
        <div>
          {d.driver_name ? (
            <div className="space-y-0.5">
              <p className="font-bold text-slate-900 text-xs">{d.driver_name}</p>
              {d.driver_phone && (
                <a
                  href={`tel:${d.driver_phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[11px] text-emerald-700 hover:text-emerald-800 font-mono flex items-center gap-1 transition-colors font-semibold"
                >
                  📞 {d.driver_phone}
                </a>
              )}
              {d.driver_email && (
                <p className="text-[10px] text-slate-500 truncate max-w-[140px]">{d.driver_email}</p>
              )}
            </div>
          ) : (
            <span className="text-xs text-slate-400 italic">Unassigned</span>
          )}
        </div>
      )
    },
    {
      header: 'IoT Sensor',
      accessor: (d) => (
        <span className="text-xs font-mono text-blue-700 font-semibold">
          {d.device_id ? (
            <span className="bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg">
              {d.device_id}
            </span>
          ) : (
            <span className="text-slate-400 italic text-[11px]">Auto / Driver</span>
          )}
        </span>
      )
    },
    {
      header: 'Start / Created',
      accessor: (d) => (
        <div className="text-xs">
          <span className="text-slate-600 font-medium block">{formatDate(d.start_time || d.created_at)}</span>
        </div>
      )
    },
    {
      header: 'Actions',
      accessor: (d) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {d.status === 'pending' && onAssignClick && (
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<UserCheck className="w-3.5 h-3.5 text-blue-600" />}
              onClick={() => onAssignClick(d)}
            >
              Assign Driver
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            onClick={() => navigate(`/deliveries/${d.id}`)}
          >
            Details
          </Button>
        </div>
      )
    }
  ];

  return (
    <DataTable
      columns={columns}
      data={deliveries}
      loading={loading}
      onRowClick={(d) => navigate(`/deliveries/${d.id}`)}
    />
  );
};
