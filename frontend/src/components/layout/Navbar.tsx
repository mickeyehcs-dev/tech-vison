import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { NotificationBell } from '../notifications/NotificationBell';
import { User, LogOut, Shield, Truck, Send, Menu, X, ChevronDown } from 'lucide-react';

export interface NavbarProps {
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, sidebarOpen }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getRoleIcon = () => {
    switch (user?.role) {
      case 'admin':
        return <Shield className="w-3.5 h-3.5 text-rose-600" />;
      case 'driver':
        return <Truck className="w-3.5 h-3.5 text-blue-600" />;
      case 'sender':
        return <Send className="w-3.5 h-3.5 text-emerald-600" />;
      default:
        return null;
    }
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 sm:px-6 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Toggle menu"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        )}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-black shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            SF
          </div>
          <div>
            <span className="font-bold text-sm text-slate-900 tracking-tight flex items-center gap-1.5">
              SmartDelivery <span className="text-emerald-600 font-mono text-xs bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">IoT+ML</span>
            </span>
            <span className="hidden sm:block text-[10px] text-slate-500 font-medium">Monitoring & Logistics</span>
          </div>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        <NotificationBell />

        {/* User Profile dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="flex items-center gap-2.5 p-1.5 pl-2.5 pr-2 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-all text-left"
          >
            <div className="hidden sm:block text-right">
              <div className="text-xs font-semibold text-slate-800 leading-tight">
                {user?.full_name || user?.email?.split('@')[0] || 'User'}
              </div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-end gap-1">
                {getRoleIcon()}
                <span>{user?.role}</span>
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-800 font-bold text-xs">
              {(user?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5 z-40 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-2 border-b border-slate-100 mb-1">
                <p className="text-xs font-bold text-slate-900 truncate">{user?.full_name || 'User'}</p>
                <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
              </div>

              <Link
                to="/profile"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors"
              >
                <User className="w-4 h-4 text-slate-500" />
                Profile Settings
              </Link>

              <button
                onClick={() => {
                  setDropdownOpen(false);
                  handleLogout();
                }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors mt-1"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
