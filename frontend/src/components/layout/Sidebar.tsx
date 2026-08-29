import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Truck,
  PlusCircle,
  Users,
  Cpu,
  ShieldCheck,
  Bell,
  User,
  Radio
} from 'lucide-react';
import { cn } from '../../utils/cn';

export interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const role = user?.role;

  const adminLinks = [
    { to: '/admin/overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { to: '/admin/deliveries', label: 'Deliveries', icon: <Truck className="w-4 h-4" /> },
    { to: '/admin/users', label: 'Manage Users', icon: <Users className="w-4 h-4" /> },
    { to: '/admin/sensors', label: 'Sensor Modules', icon: <Cpu className="w-4 h-4" /> },
    { to: '/admin/security-logs', label: 'Security Logs', icon: <ShieldCheck className="w-4 h-4" /> },
    { to: '/notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
    { to: '/profile', label: 'Profile Settings', icon: <User className="w-4 h-4" /> }
  ];

  const senderLinks = [
    { to: '/sender/overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { to: '/sender/create-delivery', label: 'Create Delivery', icon: <PlusCircle className="w-4 h-4" /> },
    { to: '/sender/deliveries', label: 'My Deliveries', icon: <Truck className="w-4 h-4" /> },
    { to: '/notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
    { to: '/profile', label: 'Profile Settings', icon: <User className="w-4 h-4" /> }
  ];

  const driverLinks = [
    { to: '/driver/overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { to: '/driver/active', label: 'On-Road Tracker', icon: <Radio className="w-4 h-4 text-emerald-600 animate-pulse" /> },
    { to: '/driver/deliveries', label: 'Assigned Deliveries', icon: <Truck className="w-4 h-4" /> },
    { to: '/notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
    { to: '/profile', label: 'Profile Settings', icon: <User className="w-4 h-4" /> }
  ];

  let links = adminLinks;
  if (role === 'sender') links = senderLinks;
  if (role === 'driver') links = driverLinks;

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={cn(
          'fixed lg:sticky top-0 lg:top-16 left-0 z-40 lg:z-20 w-64 h-screen lg:h-[calc(100vh-4rem)] bg-white border-r border-slate-200 flex flex-col justify-between p-4 transition-transform duration-300 ease-in-out shadow-sm',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex flex-col gap-6">
          {/* Mobile brand header inside sidebar */}
          <div className="lg:hidden flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-black text-xs">
                SF
              </div>
              <span className="font-bold text-sm text-slate-900">SmartDelivery</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            >
              ✕
            </button>
          </div>

          {/* Navigation links */}
          <nav className="flex flex-col gap-1">
            <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
              {role?.toUpperCase()} PORTAL
            </p>
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-150',
                    isActive
                      ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200/80 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  )
                }
              >
                <span className="shrink-0">{link.icon}</span>
                <span>{link.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
};
