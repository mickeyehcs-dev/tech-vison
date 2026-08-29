import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Input } from '../../components/common/Input';
import { PasswordInput } from '../../components/common/PasswordInput';
import { Button } from '../../components/common/Button';
import { Mail } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.warning('Please enter both email and password');
      return;
    }

    setLoading(true);
    try {
      const loggedUser = await login({ email, password });
      const displayName = loggedUser?.full_name || loggedUser?.email || 'User';
      toast.success(`Welcome back, ${displayName}!`);

      if (loggedUser?.first_login) {
        navigate('/onboarding', { replace: true });
        return;
      }

      if (from) {
        navigate(from, { replace: true });
        return;
      }

      if (loggedUser?.role === 'admin') navigate('/admin/overview', { replace: true });
      else if (loggedUser?.role === 'sender') navigate('/sender/overview', { replace: true });
      else if (loggedUser?.role === 'driver') navigate('/driver/overview', { replace: true });
      else navigate('/', { replace: true });
    } catch (err: any) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 relative overflow-hidden">
      {/* Subtle ambient pastel background circles */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-100/60 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-teal-100/60 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md bg-white border border-slate-200/90 rounded-3xl p-8 sm:p-10 shadow-xl">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-black text-2xl shadow-md shadow-emerald-500/20 mb-4">
            SF
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Smart Food Delivery</h2>
          <p className="text-xs text-slate-500 mt-1">IoT Telemetry & ML Spoilage Monitoring Platform</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <Input
            label="Email Address"
            type="email"
            placeholder="admin@smartdelivery.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail className="w-4 h-4 text-emerald-600" />}
            required
            autoFocus
          />

          <PasswordInput
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button type="submit" size="lg" loading={loading} className="w-full mt-2">
            Sign In to Portal
          </Button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-100 text-center">
          <button
            type="button"
            onClick={() => navigate('/track')}
            className="text-xs text-emerald-600 hover:text-emerald-700 font-bold transition-colors cursor-pointer"
          >
            Looking for public live tracking? Track shipment with ID →
          </button>
        </div>
      </div>
    </div>
  );
};
