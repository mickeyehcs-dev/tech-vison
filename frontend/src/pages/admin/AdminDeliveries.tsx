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

export const AdminDeliveries: React.FC = () => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [statusGroup, setStatusGroup] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedToAssign, setSelectedToAssign] = useState<Delivery | null>(null);

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
    { label: 'All Deliveries', value: 'all' },
    { label: 'Pending Assignment', value: 'pending' },
    { label: 'Current / In-Transit', value: 'current' },
    { label: 'Completed', value: 'completed' }
  ];

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Delivery Logistics</h1>
          <p className="text-xs text-slate-500 mt-1">
            Browse, filter, and assign cargo packages across active driver fleets
          </p>
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
                placeholder="Search code, food, driver, route..."
              />
            </div>
          }
          noPadding
        >
          <DeliveryTable
            deliveries={deliveries}
            loading={loading}
            isAdmin={true}
            onAssignClick={(d) => setSelectedToAssign(d)}
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

        <AssignDeliveryModal
          isOpen={Boolean(selectedToAssign)}
          onClose={() => setSelectedToAssign(null)}
          delivery={selectedToAssign}
          onSuccess={() => fetchDeliveries()}
        />
      </div>
    </DashboardLayout>
  );
};
