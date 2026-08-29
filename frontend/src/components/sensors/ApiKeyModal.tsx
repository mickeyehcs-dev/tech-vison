import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Copy, Check, AlertTriangle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceId: string;
  apiKey: string;
  isRenewal?: boolean;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  deviceId,
  apiKey,
  isRenewal = false
}) => {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      toast.success('API key copied to clipboard!');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isRenewal ? 'API Key Renewed Successfully' : 'Sensor Module Created'}
      maxWidth="md"
      showCloseButton={false}
    >
      <div className="flex flex-col gap-4">
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong className="font-bold text-amber-950">Important Security Notice:</strong>
            <p className="mt-0.5 leading-relaxed">
              This raw API key will be shown <strong>only once</strong> and is never stored in
              plaintext in the database. Please copy and flash it onto your IoT hardware device now.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-700">Device Identifier (X-DEVICE-ID)</label>
          <div className="p-3 rounded-xl bg-slate-50 font-mono text-sm text-emerald-800 font-bold border border-slate-200">
            {deviceId}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-700">Secret Device API Key (X-API-KEY)</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 p-3 rounded-xl bg-slate-50 font-mono text-xs text-slate-800 border border-slate-200 break-all select-all font-medium">
              {apiKey}
            </div>
            <Button
              size="md"
              variant={copied ? 'secondary' : 'primary'}
              leftIcon={copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              onClick={handleCopy}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>
            I Have Saved This Key
          </Button>
        </div>
      </div>
    </Modal>
  );
};
