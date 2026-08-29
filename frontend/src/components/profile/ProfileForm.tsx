import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api/auth';
import { useToast } from '../../context/ToastContext';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { User, Phone, Mail, Shield } from 'lucide-react';

export const ProfileForm: React.FC = () => {
  const { user, updateUserInState } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number || '');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updated = await authApi.updateProfile({
        fullName,
        phoneNumber
      });
      updateUserInState(updated);
      toast.success('Profile updated successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Account Email"
          value={user?.email || ''}
          disabled
          leftIcon={<Mail className="w-4 h-4 text-slate-400" />}
          helperText="Email address cannot be changed"
        />

        <Input
          label="Role"
          value={user?.role?.toUpperCase() || ''}
          disabled
          leftIcon={<Shield className="w-4 h-4 text-slate-400" />}
          helperText="Assigned by system administrator"
        />
      </div>

      <Input
        label="Full Name"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="Enter your full name"
        leftIcon={<User className="w-4 h-4 text-emerald-600" />}
      />

      <Input
        label="Phone Number"
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
        placeholder="Enter your phone number (e.g. +91 98450 11223)"
        leftIcon={<Phone className="w-4 h-4 text-emerald-600" />}
      />

      <div className="flex justify-end pt-3 border-t border-slate-100">
        <Button type="submit" size="sm" loading={loading}>
          Save Changes
        </Button>
      </div>
    </form>
  );
};
