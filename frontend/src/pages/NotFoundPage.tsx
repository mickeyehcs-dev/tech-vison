import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { PackageX, ArrowLeft } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 text-slate-900">
      <div className="flex flex-col items-center text-center max-w-md p-8 bg-white border border-slate-200/90 rounded-3xl shadow-lg">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mb-4">
          <PackageX className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-black text-slate-900 mb-2">404 - Not Found</h1>
        <p className="text-xs text-slate-500 mb-6 leading-relaxed">
          The logistics dashboard page you are trying to access does not exist or has been relocated.
        </p>
        <Button
          size="md"
          variant="primary"
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => navigate('/')}
        >
          Return to Dashboard
        </Button>
      </div>
    </div>
  );
};
