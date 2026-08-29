import React, { useState } from 'react';
import { Delivery } from '../../types';
import { Button } from '../common/Button';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { CheckCircle2, Play, CheckCheck, Radio, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface DeliveryActionsProps {
  delivery: Delivery;
  onAccept?: () => Promise<any>;
  onReject?: (reason?: string) => Promise<any>;
  onStart?: () => Promise<any>;
  onComplete?: () => Promise<any>;
  isDriver?: boolean;
}

export const DeliveryActions: React.FC<DeliveryActionsProps> = ({
  delivery,
  onAccept,
  onReject,
  onStart,
  onComplete,
  isDriver = false
}) => {
  const [loading, setLoading] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);

  if (!isDriver) return null;

  const handleAction = async (actionFn?: () => Promise<any>) => {
    if (!actionFn) return;
    setLoading(true);
    try {
      await actionFn();
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!onReject) return;
    setLoading(true);
    try {
      await onReject();
    } finally {
      setLoading(false);
      setIsRejectDialogOpen(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
      <div className="flex-1 min-w-[200px]">
        <p className="text-xs font-bold text-slate-900">Driver Action Center</p>
        <p className="text-[11px] text-slate-500">Manage delivery trip state transitions</p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {delivery.status === 'assigned' && (
          <>
            {onReject && (
              <Button
                variant="outline"
                size="md"
                loading={loading}
                leftIcon={<XCircle className="w-4 h-4 text-rose-600" />}
                onClick={() => setIsRejectDialogOpen(true)}
                className="w-full sm:w-auto text-rose-700 hover:bg-rose-50 border-rose-200"
              >
                Reject Assignment
              </Button>
            )}

            {onAccept && (
              <Button
                variant="primary"
                size="md"
                loading={loading}
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
                onClick={() => handleAction(onAccept)}
                className="w-full sm:w-auto"
              >
                Accept Delivery Assignment
              </Button>
            )}
          </>
        )}

        {delivery.status === 'accepted' && onStart && (
          <Button
            variant="success"
            size="md"
            loading={loading}
            leftIcon={<Play className="w-4 h-4" />}
            onClick={() => handleAction(onStart)}
            className="w-full sm:w-auto"
          >
            Start Delivery Trip (Activate GPS & IoT)
          </Button>
        )}

        {delivery.status === 'in_transit' && (
          <>
            <Link to="/driver/active">
              <Button
                variant="secondary"
                size="md"
                leftIcon={<Radio className="w-4 h-4 text-emerald-600 animate-pulse" />}
              >
                Live GPS Tracker
              </Button>
            </Link>
            {onComplete && (
              <Button
                variant="primary"
                size="md"
                loading={loading}
                leftIcon={<CheckCheck className="w-4 h-4" />}
                onClick={() => handleAction(onComplete)}
                className="w-full sm:w-auto"
              >
                Complete Delivery
              </Button>
            )}
          </>
        )}

        {delivery.status === 'completed' && (
          <span className="text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 px-3 py-2 rounded-xl flex items-center gap-1.5">
            <CheckCheck className="w-4 h-4 text-teal-600" /> Delivery is successfully completed
          </span>
        )}
      </div>

      {/* Reject Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isRejectDialogOpen}
        onClose={() => setIsRejectDialogOpen(false)}
        onConfirm={handleConfirmReject}
        title="Reject Delivery Assignment"
        message={`Are you sure you want to decline delivery #${delivery.delivery_code} (${delivery.food_name})? The sender and dispatch team will be notified, and the delivery will be returned to pending status.`}
        confirmText="Yes, Decline Assignment"
        variant="danger"
      />
    </div>
  );
};
