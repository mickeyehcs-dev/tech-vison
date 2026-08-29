import React from 'react';
import { SensorModule } from '../../types';
import { SensorStatusBadge } from '../common/SensorStatusBadge';
import { LiveStatusBadge } from '../common/LiveStatusBadge';
import { formatRelativeTime } from '../../utils/formatters';
import { Cpu, Radio, Key, Trash2 } from 'lucide-react';
import { Button } from '../common/Button';

export interface SensorCardProps {
  module: SensorModule;
  onRenewKey?: (module: SensorModule) => void;
  onDelete?: (module: SensorModule) => void;
}

export const SensorCard: React.FC<SensorCardProps> = ({ module, onRenewKey, onDelete }) => {
  return (
    <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">{module.device_name}</h4>
              <p className="text-[11px] font-mono text-emerald-700 font-bold">{module.device_id}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <LiveStatusBadge isLive={module.is_live} />
            <SensorStatusBadge status={module.status} />
          </div>
        </div>

        <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 my-3">
          <div className="flex justify-between">
            <span>Hardware Model:</span>
            <span className="text-slate-900 font-bold">{module.hardware_model}</span>
          </div>
          <div className="flex justify-between">
            <span>Firmware:</span>
            <span className="text-slate-700 font-mono">v{module.firmware_version}</span>
          </div>
          <div className="flex justify-between">
            <span>Current Assignment:</span>
            <span className="text-slate-900 font-bold truncate max-w-[150px]">
              {module.current_delivery_code ? `#${module.current_delivery_code}` : 'None'}
            </span>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
          <Radio className="w-3 h-3" />
          <span>
            {module.last_seen_at
              ? `Seen ${formatRelativeTime(module.last_seen_at)}`
              : 'Never connected'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {onRenewKey && (
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Key className="w-3.5 h-3.5 text-amber-600" />}
              onClick={() => onRenewKey(module)}
              title="Renew API Key"
            >
              Key
            </Button>
          )}
          {onDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="text-rose-600 hover:bg-rose-50"
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() => onDelete(module)}
              title="Remove Sensor"
            >
              Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
