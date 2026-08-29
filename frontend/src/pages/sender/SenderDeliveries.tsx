import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { SectionCard } from '../../components/common/SectionCard';
import { DeliveryTable } from '../../components/delivery/DeliveryTable';
import { AssignDeliveryModal } from '../../components/delivery/AssignDeliveryModal';
import { SearchBar } from '../../components/common/SearchBar';
import { FilterBar } from '../../components/common/FilterBar';
import { Pagination } from '../../components/common/Pagination';
import { Delivery } from '../../types';
import { deliveriesApi } from '../../api/deliveries';
import { useDebounce } from '../../hooks/useDebounce';
import { usePagination } from '../../hooks/usePagination';
import { useToast } from '../../context/ToastContext';

export const SenderDeliveries: React.FC = () => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [statusGroup, setStatusGroup] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [assignDeliveryTarget, setAssignDeliveryTarget] = useState<Delivery | null>(null);

  const debouncedSearch = useDebounce(search, 300);
  const { page, limit, total, setTotal, setPage, totalPages } = usePagination(1, 10);
  const toast = useToast();

  const fetchDeliveries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await deliveriesApi.listDeliveries({
        statusGroup: statusGroup === 'all' ? undefined : (statusGroup as any),
        search: debouncedSearch || undefined,
        page,
        limit
      });
      setDeliveries(res.deliveries);
      setTotal(res.total);
    } catch (err: any) {
      toast.error('Failed to load deliveries');
    } finally {
      setLoading(false);
    }
  }, [statusGroup, debouncedSearch, page, limit, setTotal, toast]);

  useEffect(() => {
    fetchDeliveries();
  }, [fetchDeliveries]);

  const filterOptions = [
    { label: 'All My Shipments', value: 'all' },
    { label: 'Pending Assignment', value: 'pending' },
    { label: 'In Transit', value: 'current' },
    { label: 'Delivered / Completed', value: 'completed' }
  ];

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">My Deliveries</h1>
          <p className="text-xs text-slate-500 mt-1">Track and review all your food deliveries and risk logs</p>
        </div>

        <SectionCard
          title={
            <div className="flex flex-wrap items-center justify-between gap-4 w-full">
              <FilterBar
                options={filterOptions}
                selectedValue={statusGroup}
                onSelect={(val) => {
                  setStatusGroup(val);
                  setPage(1);
                }}
              />
              <SearchBar
                value={search}
                onChange={(v) => {
                  setSearch(v);
                  setPage(1);
                }}
                placeholder="Search food item, code..."
              />
            </div>
          }
          noPadding
        >
          <DeliveryTable
            deliveries={deliveries}
            loading={loading}
            onAssignClick={(d) => setAssignDeliveryTarget(d)}
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

        {/* Assign Driver Modal */}
        <AssignDeliveryModal
          isOpen={Boolean(assignDeliveryTarget)}
          delivery={assignDeliveryTarget}
          onClose={() => setAssignDeliveryTarget(null)}
          onSuccess={() => {
            setAssignDeliveryTarget(null);
            fetchDeliveries();
          }}
        />
      </div>
    </DashboardLayout>
  );
};
