import React from 'react';
import { SensorModule } from '../../types';
import { DataTable, Column } from '../common/DataTable';
import { SensorStatusBadge } from '../common/SensorStatusBadge';
import { LiveStatusBadge } from '../common/LiveStatusBadge';
import { formatDate, formatRelativeTime } from '../../utils/formatters';
import { Button } from '../common/Button';
import { Key, Trash2, UserCheck } from 'lucide-react';

export interface SensorTableProps {
  sensors: SensorModule[];
  loading?: boolean;
  onRenewKey?: (sensor: SensorModule) => void;
  onDelete?: (sensor: SensorModule) => void;
  onAssignDriver?: (sensor: SensorModule) => void;
}

export const SensorTable: React.FC<SensorTableProps> = ({
  sensors,
  loading = false,
  onRenewKey,
  onDelete,
  onAssignDriver
}) => {
  const columns: Column<SensorModule>[] = [
    {
      header: 'Device ID',
      accessor: (s) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">{s.device_id}</span>
        </div>
      )
    },
    {
      header: 'Device Name',
      accessor: (s) => <span className="font-bold text-slate-900">{s.device_name}</span>
    },
    {
      header: 'Model / Firmware',
      accessor: (s) => (
        <span className="text-xs text-slate-600">
          {s.hardware_model} <span className="font-mono text-slate-400">(v{s.firmware_version})</span>
        </span>
      )
    },
    {
      header: 'Live Status',
      accessor: (s) => <LiveStatusBadge isLive={s.is_live} />
    },
    {
      header: 'Status',
      accessor: (s) => <SensorStatusBadge status={s.status} />
    },
    {
      header: 'Assigned Driver',
      accessor: (s) => (
        <div className="text-xs">
          {s.driver_name ? (
            <div>
              <span className="font-bold text-slate-900 block">{s.driver_name}</span>
              {s.driver_phone && <span className="text-[11px] text-emerald-700 font-mono font-medium">{s.driver_phone}</span>}
            </div>
          ) : (
            <span className="text-slate-400 italic">Unassigned (Pool)</span>
          )}
        </div>
      )
    },
    {
      header: 'Active Delivery',
      accessor: (s) => (
        <span className="text-xs font-mono text-blue-700 font-semibold">
          {s.current_delivery_code ? `#${s.current_delivery_code}` : <span className="text-slate-400 italic font-normal">None</span>}
        </span>
      )
    },
    {
      header: 'Last Seen',
      accessor: (s) => (
        <span className="text-xs text-slate-600 font-medium">
          {s.last_seen_at ? formatRelativeTime(s.last_seen_at) : 'Never'}
        </span>
      )
    },
    {
      header: 'Registered',
      accessor: (s) => (
        <span className="text-xs text-slate-400">{formatDate(s.created_at)}</span>
      )
    },
    {
      header: 'Actions',
      accessor: (s) => (
        <div className="flex items-center gap-2">
          {onAssignDriver && (
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<UserCheck className="w-3.5 h-3.5 text-blue-600" />}
              onClick={() => onAssignDriver(s)}
            >
              {s.driver_id ? 'Reassign Driver' : 'Assign Driver'}
            </Button>
          )}
          {onRenewKey && (
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Key className="w-3.5 h-3.5 text-amber-600" />}
              onClick={() => onRenewKey(s)}
            >
              Renew Key
            </Button>
          )}
          {onDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() => onDelete(s)}
            >
              Remove
            </Button>
          )}
        </div>
      )
    }
  ];

  return <DataTable columns={columns} data={sensors} loading={loading} />;
};
