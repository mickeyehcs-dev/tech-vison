import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { SectionCard } from '../../components/common/SectionCard';
import { DataTable, Column } from '../../components/common/DataTable';
import { SearchBar } from '../../components/common/SearchBar';
import { FilterBar } from '../../components/common/FilterBar';
import { Pagination } from '../../components/common/Pagination';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { Badge } from '../../components/common/Badge';
import { User, UserRole } from '../../types';
import { usersApi } from '../../api/users';
import { useDebounce } from '../../hooks/useDebounce';
import { usePagination } from '../../hooks/usePagination';
import { useToast } from '../../context/ToastContext';
import { formatDate } from '../../utils/formatters';
import { UserPlus, Edit, UserCheck, UserX, Trash2, Shield, Truck, Send } from 'lucide-react';

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [createdUserResult, setCreatedUserResult] = useState<{ user: User; initialPassword: string } | null>(null);

  // Form states
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('driver');
  const [formFullName, setFormFullName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const debouncedSearch = useDebounce(search, 300);
  const { page, limit, total, setTotal, setPage, totalPages } = usePagination(1, 10);
  const toast = useToast();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await usersApi.listUsers({
        role: roleFilter === 'all' ? undefined : (roleFilter as UserRole),
        search: debouncedSearch || undefined,
        page,
        limit
      });
      setUsers(res.users);
      setTotal(res.total);
    } catch (err: any) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [roleFilter, debouncedSearch, page, limit, setTotal, toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmail || !formRole) {
      toast.warning('Email and role are required');
      return;
    }

    setSubmitting(true);
    try {
      const res = await usersApi.createUser({
        email: formEmail,
        role: formRole,
        fullName: formFullName || undefined,
        phoneNumber: formPhone || undefined,
        initialPassword: formPassword || undefined
      });

      toast.success(`User ${res.user.email} created successfully!`);
      setCreatedUserResult(res);
      setIsAddModalOpen(false);
      setFormEmail('');
      setFormFullName('');
      setFormPhone('');
      setFormPassword('');
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;

    setSubmitting(true);
    try {
      await usersApi.updateUser(editUser.id, {
        fullName: formFullName,
        phoneNumber: formPhone
      });
      toast.success('User details updated!');
      setEditUser(null);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: User) => {
    try {
      const newStatus = !user.is_active;
      await usersApi.setUserStatus(user.id, newStatus);
      toast.success(`User ${user.email} is now ${newStatus ? 'active' : 'inactive'}`);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update user status');
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    try {
      await usersApi.deleteUser(deleteTarget.id);
      toast.success(`User ${deleteTarget.email} soft deleted successfully`);
      setDeleteTarget(null);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete user');
    }
  };

  const columns: Column<User>[] = [
    {
      header: 'User / Email',
      accessor: (u) => (
        <div>
          <p className="font-bold text-slate-900">{u.full_name || 'No Name Set'}</p>
          <p className="text-xs text-slate-500 font-mono">{u.email}</p>
        </div>
      )
    },
    {
      header: 'Role',
      accessor: (u) => {
        if (u.role === 'admin')
          return (
            <Badge variant="danger" className="gap-1">
              <Shield className="w-3 h-3" /> Admin
            </Badge>
          );
        if (u.role === 'driver')
          return (
            <Badge variant="info" className="gap-1">
              <Truck className="w-3 h-3" /> Driver
            </Badge>
          );
        return (
          <Badge variant="primary" className="gap-1">
            <Send className="w-3 h-3" /> Sender
          </Badge>
        );
      }
    },
    {
      header: 'Phone',
      accessor: (u) => <span className="text-xs text-slate-700 font-medium">{u.phone_number || '--'}</span>
    },
    {
      header: 'Status',
      accessor: (u) =>
        u.is_active ? (
          <Badge variant="success">Active</Badge>
        ) : (
          <Badge variant="danger">Inactive</Badge>
        )
    },
    {
      header: 'Onboarding',
      accessor: (u) =>
        u.first_login ? (
          <Badge variant="warning">Setup Pending</Badge>
        ) : (
          <span className="text-xs text-emerald-700 font-bold">Completed</span>
        )
    },
    {
      header: 'Created',
      accessor: (u) => (
        <span className="text-xs text-slate-400">{formatDate(u.created_at)}</span>
      )
    },
    {
      header: 'Actions',
      accessor: (u) => (
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Edit className="w-3.5 h-3.5" />}
            onClick={() => {
              setEditUser(u);
              setFormFullName(u.full_name || '');
              setFormPhone(u.phone_number || '');
            }}
            title="Edit User"
          >
            Edit
          </Button>

          <Button
            size="sm"
            variant={u.is_active ? 'secondary' : 'primary'}
            leftIcon={
              u.is_active ? (
                <UserX className="w-3.5 h-3.5 text-amber-600" />
              ) : (
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
              )
            }
            onClick={() => handleToggleStatus(u)}
            title={u.is_active ? 'Deactivate Account' : 'Activate Account'}
          >
            {u.is_active ? 'Deactivate' : 'Activate'}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="text-rose-600 hover:bg-rose-50"
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            onClick={() => setDeleteTarget(u)}
            title="Delete User"
          >
            Delete
          </Button>
        </div>
      )
    }
  ];

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">User Directory</h1>
            <p className="text-xs text-slate-500 mt-1">
              Manage accounts, driver permissions, sender registrations, and credentials
            </p>
          </div>
          <Button
            size="sm"
            leftIcon={<UserPlus className="w-4 h-4" />}
            onClick={() => {
              setFormEmail('');
              setFormFullName('');
              setFormPhone('');
              setFormPassword('');
              setIsAddModalOpen(true);
            }}
          >
            Add New User
          </Button>
        </div>

        <SectionCard
          title={
            <div className="flex flex-wrap items-center justify-between gap-4 w-full">
              <FilterBar
                options={[
                  { label: 'All Users', value: 'all' },
                  { label: 'Drivers', value: 'driver' },
                  { label: 'Senders', value: 'sender' },
                  { label: 'Admins', value: 'admin' }
                ]}
                selectedValue={roleFilter}
                onSelect={(v) => {
                  setRoleFilter(v);
                  setPage(1);
                }}
              />
              <SearchBar
                value={search}
                onChange={(v) => {
                  setSearch(v);
                  setPage(1);
                }}
                placeholder="Search email, name, phone..."
              />
            </div>
          }
          noPadding
        >
          <DataTable columns={columns} data={users} loading={loading} />
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

        {/* Add User Modal */}
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Create New User Account"
          description="User will be flagged with first_login=1 and guided through onboarding upon first sign in"
          maxWidth="md"
        >
          <form onSubmit={handleCreateUser} className="flex flex-col gap-4">
            <Input
              label="Email Address"
              type="email"
              placeholder="e.g. driver.john@delivery.com"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              required
              autoFocus
            />

            <Select
              label="Assigned Role"
              value={formRole}
              onChange={(e) => setFormRole(e.target.value as UserRole)}
              options={[
                { value: 'driver', label: 'Driver (Fleet Transporter)' },
                { value: 'sender', label: 'Sender (Food Producer / Merchant)' },
                { value: 'admin', label: 'Administrator (System Manager)' }
              ]}
              required
            />

            <Input
              label="Full Name (Optional)"
              placeholder="e.g. Johnathan Smith"
              value={formFullName}
              onChange={(e) => setFormFullName(e.target.value)}
            />

            <Input
              label="Phone Number (Optional)"
              placeholder="e.g. +91 98450 11223"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
            />

            <Input
              label="Temporary Password (Optional)"
              placeholder="Leave blank to auto-generate secure password"
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
              helperText="User will reset this password during mandatory onboarding"
            />

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={submitting}>
                Create Account
              </Button>
            </div>
          </form>
        </Modal>

        {/* Edit User Modal */}
        <Modal
          isOpen={Boolean(editUser)}
          onClose={() => setEditUser(null)}
          title={`Edit User: ${editUser?.email}`}
          maxWidth="md"
        >
          <form onSubmit={handleUpdateUser} className="flex flex-col gap-4">
            <Input
              label="Full Name"
              value={formFullName}
              onChange={(e) => setFormFullName(e.target.value)}
              placeholder="Full name"
            />
            <Input
              label="Phone Number"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              placeholder="Phone number"
            />
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditUser(null)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={submitting}>
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>

        {/* Created User Result Dialog */}
        <Modal
          isOpen={Boolean(createdUserResult)}
          onClose={() => setCreatedUserResult(null)}
          title="User Account Provisioned"
          maxWidth="sm"
        >
          <div className="flex flex-col gap-3">
            <p className="text-xs text-slate-600">
              The user account was created with temporary credentials. Provide these details to the user:
            </p>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              <p className="font-mono text-slate-800 font-medium">
                <strong>Email:</strong> {createdUserResult?.user.email}
              </p>
              <p className="font-mono text-emerald-700 font-bold">
                <strong>Temp Password:</strong> {createdUserResult?.initialPassword}
              </p>
              <p className="text-slate-600">
                <strong>Role:</strong> {createdUserResult?.user.role.toUpperCase()}
              </p>
            </div>
            <div className="flex justify-end pt-3">
              <Button size="sm" onClick={() => setCreatedUserResult(null)}>
                Done
              </Button>
            </div>
          </div>
        </Modal>

        {/* Soft Delete Confirm Dialog */}
        <ConfirmDialog
          isOpen={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteUser}
          title="Delete User Account"
          message={`Are you sure you want to remove ${deleteTarget?.email}? The user will be soft-deleted to preserve all historical deliveries and audit records.`}
          confirmText="Yes, Soft Delete"
        />
      </div>
    </DashboardLayout>
  );
};
