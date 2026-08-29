import React from 'react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { SectionCard } from '../../components/common/SectionCard';
import { ProfileForm } from '../../components/profile/ProfileForm';
import { PasswordChangeForm } from '../../components/profile/PasswordChangeForm';
import { User, KeyRound } from 'lucide-react';

export const ProfilePage: React.FC = () => {
  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 max-w-2xl mx-auto">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Profile & Security</h1>
          <p className="text-xs text-slate-500 mt-1">
            Update personal contact information and change account credentials
          </p>
        </div>

        <SectionCard
          title={
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-600" />
              <span>Personal Details</span>
            </div>
          }
        >
          <ProfileForm />
        </SectionCard>

        <SectionCard
          title={
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-600" />
              <span>Change Account Password</span>
            </div>
          }
        >
          <PasswordChangeForm />
        </SectionCard>
      </div>
    </DashboardLayout>
  );
};
