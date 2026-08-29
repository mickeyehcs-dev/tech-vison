import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { SectionCard } from '../../components/common/SectionCard';
import { DataTable, Column } from '../../components/common/DataTable';
import { SearchBar } from '../../components/common/SearchBar';
import { FilterBar } from '../../components/common/FilterBar';
import { Pagination } from '../../components/common/Pagination';
import { SecurityLog } from '../../types';
import { securityApi } from '../../api/security';
import { useDebounce } from '../../hooks/useDebounce';
import { usePagination } from '../../hooks/usePagination';
import { useToast } from '../../context/ToastContext';
import { formatDate } from '../../utils/formatters';
import { ShieldCheck, ShieldAlert, CheckCircle2, XCircle } from 'lucide-react';

export const AdminSecurityLogs: React.FC = () => {
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const debouncedSearch = useDebounce(search, 300);
  const { page, limit, total, setTotal, setPage, totalPages } = usePagination(1, 20);
  const toast = useToast();

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await securityApi.listLogs({
        event_type: eventTypeFilter === 'all' ? undefined : eventTypeFilter,
        search: debouncedSearch || undefined,
        page,
        limit
      });
      setLogs(res.logs);
      setTotal(res.total);
    } catch (err: any) {
      toast.error('Failed to load security audit logs');
    } finally {
      setLoading(false);
    }
  }, [eventTypeFilter, debouncedSearch, page, limit, setTotal, toast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const columns: Column<SecurityLog>[] = [
    {
      header: 'Event Type',
      accessor: (l) => {
        const isFailure = !l.success || l.event_type.includes('FAILED') || l.event_type.includes('UNAUTHORIZED');
        return (
          <div className="flex items-center gap-2">
            {isFailure ? (
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span className="font-mono text-xs font-bold text-slate-900">{l.event_type}</span>
          </div>
        );
      }
    },
    {
      header: 'User / Email',
      accessor: (l) => (
        <span className="text-xs text-slate-700 font-mono font-medium">
          {l.email || <span className="text-slate-400 italic">System / Anonymous</span>}
        </span>
      )
    },
    {
      header: 'Status',
      accessor: (l) =>
        l.success ? (
          <span className="flex items-center gap-1 text-xs text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> SUCCESS
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
            <XCircle className="w-3.5 h-3.5" /> FAILED
          </span>
        )
    },
    {
      header: 'IP Address',
      accessor: (l) => <span className="text-xs font-mono text-slate-600">{l.ip_address || '127.0.0.1'}</span>
    },
    {
      header: 'Details',
      accessor: (l) => (
        <div className="text-[11px] font-mono text-slate-500 max-w-[280px] truncate">
          {l.details_json ? JSON.stringify(l.details_json) : '--'}
        </div>
      )
    },
    {
      header: 'Timestamp',
      accessor: (l) => (
        <span className="text-xs text-slate-400">{formatDate(l.created_at)}</span>
      )
    }
  ];

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Security Audit Logs</h1>
          <p className="text-xs text-slate-500 mt-1">
            Immutable system audit trail tracking authentication, key renewals, and mutations
          </p>
        </div>

        <SectionCard
          title={
            <div className="flex flex-wrap items-center justify-between gap-4 w-full">
              <FilterBar
                options={[
                  { label: 'All Events', value: 'all' },
                  { label: 'Login Success', value: 'LOGIN_SUCCESS' },
                  { label: 'Login Failed', value: 'LOGIN_FAILED' },
                  { label: 'Deliveries', value: 'DELIVERY_CREATED' },
                  { label: 'Sensor Key Renewed', value: 'SENSOR_KEY_RENEWED' }
                ]}
                selectedValue={eventTypeFilter}
                onSelect={(v) => {
                  setEventTypeFilter(v);
                  setPage(1);
                }}
              />
              <SearchBar
                value={search}
                onChange={(v) => {
                  setSearch(v);
                  setPage(1);
                }}
                placeholder="Search event, email, IP..."
              />
            </div>
          }
          noPadding
        >
          <DataTable columns={columns} data={logs} loading={loading} />
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
      </div>
    </DashboardLayout>
  );
};
