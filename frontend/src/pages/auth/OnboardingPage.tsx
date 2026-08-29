import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { authApi } from '../../api/auth';
import { Input } from '../../components/common/Input';
import { PasswordInput } from '../../components/common/PasswordInput';
import { Button } from '../../components/common/Button';
import { User, Phone, Sparkles } from 'lucide-react';

export const OnboardingPage: React.FC = () => {
  const { user, updateUserInState } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !phoneNumber || !newPassword || !confirmPassword) {
      toast.warning('Please complete all onboarding fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);
    try {
      const updated = await authApi.completeOnboarding({
        fullName,
        phoneNumber,
        newPassword,
        confirmPassword
      });

      updateUserInState(updated);
      toast.success('Account onboarding completed! Welcome to Smart Food Delivery.');

      if (updated.role === 'admin') navigate('/admin/overview', { replace: true });
      else if (updated.role === 'sender') navigate('/sender/overview', { replace: true });
      else if (updated.role === 'driver') navigate('/driver/overview', { replace: true });
      else navigate('/', { replace: true });
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-100/60 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-lg bg-white border border-slate-200/90 rounded-3xl p-8 sm:p-10 shadow-xl">
        <div className="flex items-center gap-3 mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800">
          <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">First-Time Setup Required</h3>
            <p className="text-xs text-slate-600">
              Welcome to the team! Please setup your profile information and configure your permanent password.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Assigned Email"
              value={user?.email || ''}
              disabled
              helperText="Permanent account identifier"
            />
            <Input
              label="Assigned Role"
              value={user?.role?.toUpperCase() || ''}
              disabled
              helperText="Access permissions set by admin"
            />
          </div>

          <Input
            label="Full Name"
            placeholder="e.g. Venkatesh Reddy"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            leftIcon={<User className="w-4 h-4 text-emerald-600" />}
            required
            autoFocus
          />

          <Input
            label="Phone Number"
            placeholder="e.g. +91 98450 11223"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            leftIcon={<Phone className="w-4 h-4 text-emerald-600" />}
            required
          />

          <div className="pt-2 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              Set Permanent Password
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PasswordInput
                label="New Password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />

              <PasswordInput
                label="Confirm Password"
                placeholder="Re-type password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <Button type="submit" size="lg" loading={loading} className="w-full mt-4">
            Complete Onboarding & Enter Portal
          </Button>
        </form>
      </div>
    </div>
  );
};
