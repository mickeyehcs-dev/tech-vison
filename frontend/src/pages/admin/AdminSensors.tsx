import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { SectionCard } from '../../components/common/SectionCard';
import { SensorTable } from '../../components/sensors/SensorTable';
import { AddSensorModal } from '../../components/sensors/AddSensorModal';
import { ApiKeyModal } from '../../components/sensors/ApiKeyModal';
import { AssignDriverSensorModal } from '../../components/sensors/AssignDriverSensorModal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { SearchBar } from '../../components/common/SearchBar';
import { FilterBar } from '../../components/common/FilterBar';
import { Pagination } from '../../components/common/Pagination';
import { Button } from '../../components/common/Button';
import { SensorModule } from '../../types';
import { sensorsApi } from '../../api/sensors';
import { useDebounce } from '../../hooks/useDebounce';
import { usePagination } from '../../hooks/usePagination';
import { useToast } from '../../context/ToastContext';
import { Download, Plus } from 'lucide-react';

export const AdminSensors: React.FC = () => {
  const [sensors, setSensors] = useState<SensorModule[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newKeyModalData, setNewKeyModalData] = useState<{
    deviceId: string;
    apiKey: string;
    isRenewal: boolean;
  } | null>(null);
  const [renewTarget, setRenewTarget] = useState<SensorModule | null>(null);
  const [removeTarget, setRemoveTarget] = useState<SensorModule | null>(null);
  const [assignDriverTarget, setAssignDriverTarget] = useState<SensorModule | null>(null);

  const debouncedSearch = useDebounce(search, 300);
  const { page, limit, total, setTotal, setPage, totalPages } = usePagination(1, 10);
  const toast = useToast();

  const fetchSensors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await sensorsApi.listModules({
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: debouncedSearch || undefined,
        page,
        limit
      });
      setSensors(res.sensors);
      setTotal(res.total);
    } catch (err: any) {
      toast.error('Failed to load sensor modules');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, debouncedSearch, page, limit, setTotal, toast]);

  useEffect(() => {
    fetchSensors();
  }, [fetchSensors]);

  const handleRenewKey = async () => {
    if (!renewTarget) return;
    try {
      const res = await sensorsApi.renewApiKey(renewTarget.id);
      setNewKeyModalData({
        deviceId: renewTarget.device_id,
        apiKey: res.rawApiKey,
        isRenewal: true
      });
      setRenewTarget(null);
      toast.success('API key renewed successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to renew API key');
    }
  };

  const handleRemoveSensor = async () => {
    if (!removeTarget) return;
    try {
      await sensorsApi.deleteModule(removeTarget.id);
      toast.success(`Sensor ${removeTarget.device_name} removed`);
      setRemoveTarget(null);
      fetchSensors();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove sensor');
    }
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const csvText = await sensorsApi.exportLogsCsv();
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `smart_food_sensor_logs_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Sensor telemetry exported to CSV successfully!');
    } catch (err: any) {
      toast.error('Failed to export telemetry data');
    } finally {
      setExporting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Sensor Modules (IoT)</h1>
            <p className="text-xs text-slate-500 mt-1">
              Hardware tracking devices, unique Device IDs, secret API keys, and telemetry export
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              loading={exporting}
              leftIcon={<Download className="w-4 h-4 text-emerald-600" />}
              onClick={handleExportCsv}
            >
              Export CSV Logs
            </Button>
            <Button
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setIsAddModalOpen(true)}
            >
              Add Sensor Module
            </Button>
          </div>
        </div>

        <SectionCard
          title={
            <div className="flex flex-wrap items-center justify-between gap-4 w-full">
              <FilterBar
                options={[
                  { label: 'All Modules', value: 'all' },
                  { label: 'Available', value: 'available' },
                  { label: 'Assigned', value: 'assigned' },
                  { label: 'Offline', value: 'offline' }
                ]}
                selectedValue={statusFilter}
                onSelect={(v) => {
                  setStatusFilter(v);
                  setPage(1);
                }}
              />
              <SearchBar
                value={search}
                onChange={(v) => {
                  setSearch(v);
                  setPage(1);
                }}
                placeholder="Search device name, SFM ID..."
              />
            </div>
          }
          noPadding
        >
          <SensorTable
            sensors={sensors}
            loading={loading}
            onRenewKey={(s) => setRenewTarget(s)}
            onDelete={(s) => setRemoveTarget(s)}
            onAssignDriver={(s) => setAssignDriverTarget(s)}
          />

          <div className="p-4 border-t border-slate-100">
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              limit={limit}
              onPageChange={setPage}
            />
          </div>
        </SectionCard>

        {/* Add Sensor Modal */}
        <AddSensorModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={(mod, key) => {
            fetchSensors();
            setNewKeyModalData({
              deviceId: mod.device_id,
              apiKey: key,
              isRenewal: false
            });
          }}
        />

        {/* API Key Modal */}
        {newKeyModalData && (
          <ApiKeyModal
            isOpen={Boolean(newKeyModalData)}
            onClose={() => setNewKeyModalData(null)}
            deviceId={newKeyModalData.deviceId}
            apiKey={newKeyModalData.apiKey}
            isRenewal={newKeyModalData.isRenewal}
          />
        )}

        {/* Renew Key Confirm */}
        <ConfirmDialog
          isOpen={Boolean(renewTarget)}
          onClose={() => setRenewTarget(null)}
          onConfirm={handleRenewKey}
          title="Renew Device API Key"
          message={`Are you sure you want to renew the secret API key for ${renewTarget?.device_name} (${renewTarget?.device_id})? The old key will immediately become invalid.`}
          confirmText="Yes, Generate New Key"
          variant="primary"
        />

        {/* Remove Sensor Confirm */}
        <ConfirmDialog
          isOpen={Boolean(removeTarget)}
          onClose={() => setRemoveTarget(null)}
          onConfirm={handleRemoveSensor}
          title="Remove Sensor Module"
          message={`Are you sure you want to remove ${removeTarget?.device_name} (${removeTarget?.device_id})? All historical telemetry readings will remain preserved in logs.`}
          confirmText="Yes, Soft Remove"
        />

        {/* Assign Driver to Sensor Modal */}
        <AssignDriverSensorModal
          isOpen={Boolean(assignDriverTarget)}
          sensor={assignDriverTarget}
          onClose={() => setAssignDriverTarget(null)}
          onSuccess={() => {
            setAssignDriverTarget(null);
            fetchSensors();
          }}
        />
      </div>
    </DashboardLayout>
  );
};
