import React, { useState } from 'react';
import { blockchainApi } from '../../api/blockchain';
import { useToast } from '../../context/ToastContext';
import { BatchVerificationResult, BlockchainBatch } from '../../types';
import { AlertTriangle, CheckCircle2, ShieldAlert, RefreshCw, Zap, ShieldCheck, Bug, Wrench } from 'lucide-react';

interface TamperSimulatorProps {
  batches: BlockchainBatch[];
  onActionComplete?: () => void;
  onVerificationResult?: (res: BatchVerificationResult | null) => void;
}

export const TamperSimulator: React.FC<TamperSimulatorProps> = ({
  batches,
  onActionComplete,
  onVerificationResult
}) => {
  const { success, error, warning } = useToast();
  const [selectedBatchId, setSelectedBatchId] = useState<string>(batches[0]?.batch_id || '');
  const [tamperedField, setTamperedField] = useState<string>('temperature');
  const [tamperedValue, setTamperedValue] = useState<number>(28.5);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastTamperMessage, setLastTamperMessage] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<BatchVerificationResult | null>(null);

  const selectedBatch = batches.find((b) => b.batch_id === selectedBatchId) || batches[0];

  const handleSimulateTamper = async () => {
    if (!selectedBatch) {
      error('Please select a batch first');
      return;
    }

    try {
      setIsLoading(true);
      const res = await blockchainApi.simulateTamper({
        delivery_id: selectedBatch.delivery_id,
        field: tamperedField,
        new_value: Number(tamperedValue)
      });

      setLastTamperMessage(res.message);
      warning('⚠️ Simulated attack: MySQL record modified directly!');

      // Trigger verification immediately to demonstrate detection
      const verifyRes = await blockchainApi.verifyBatch(selectedBatch.batch_id);
      setVerificationResult(verifyRes);
      if (onVerificationResult) onVerificationResult(verifyRes);
      if (onActionComplete) onActionComplete();
    } catch (err: any) {
      error(err.message || 'Failed to simulate tamper');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyBatch = async () => {
    if (!selectedBatch) return;

    try {
      setIsLoading(true);
      const res = await blockchainApi.verifyBatch(selectedBatch.batch_id);
      setVerificationResult(res);
      if (onVerificationResult) onVerificationResult(res);

      if (res.verified) {
        success('✓ Cryptographic Verification PASSED: Batch data is valid!');
      } else {
        error('⚠ TAMPER DETECTED: MySQL data differs from Hyperledger Fabric root!');
      }
    } catch (err: any) {
      error(err.message || 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestoreIntegrity = async () => {
    if (!selectedBatch) return;

    try {
      setIsLoading(true);
      const res = await blockchainApi.restoreTamper(selectedBatch.delivery_id);
      setLastTamperMessage(null);
      success('✓ Database integrity restored! Recalculating proof...');

      // Re-verify after restore
      const verifyRes = await blockchainApi.verifyBatch(selectedBatch.batch_id);
      setVerificationResult(verifyRes);
      if (onVerificationResult) onVerificationResult(verifyRes);
      if (onActionComplete) onActionComplete();
    } catch (err: any) {
      error(err.message || 'Failed to restore integrity');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Card Header */}
      <div className="p-6 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <Bug className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base flex items-center gap-2">
              Tamper-Evidence & Attack Simulation Sandbox
              <span className="text-[10px] uppercase tracking-wider font-semibold bg-rose-500/30 text-rose-200 px-2 py-0.5 rounded-full border border-rose-500/40">
                Live Demo Tool
              </span>
            </h3>
            <p className="text-xs text-slate-300">
              Inject unauthorized database modifications to demonstrate instant cryptographic detection by Hyperledger Fabric Merkle proof.
            </p>
          </div>
        </div>

        {verificationResult && (
          <div
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-2 border shadow-sm ${
              verificationResult.verified
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-rose-500/30 text-rose-200 border-rose-500/50 animate-pulse'
            }`}
          >
            {verificationResult.verified ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>INTEGRITY VERIFIED (VALID)</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>TAMPER DETECTED (FAILED)</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Controls & Configuration */}
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Batch Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Select Batch for Audit
            </label>
            <select
              value={selectedBatchId || (selectedBatch ? selectedBatch.batch_id : '')}
              onChange={(e) => {
                setSelectedBatchId(e.target.value);
                setVerificationResult(null);
                setLastTamperMessage(null);
              }}
              className="w-full text-xs font-mono font-medium bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {batches.map((b) => (
                <option key={b.batch_id} value={b.batch_id}>
                  {b.batch_id} ({b.delivery_code || `DEL-${b.delivery_id}`} • {b.record_count} logs)
                </option>
              ))}
            </select>
          </div>

          {/* Tamper Field */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Simulated Target Field
            </label>
            <select
              value={tamperedField}
              onChange={(e) => setTamperedField(e.target.value)}
              className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="temperature">temperature (Manipulate °C)</option>
              <option value="humidity">humidity (Manipulate %)</option>
              <option value="methane">methane (Decomposition gas ppm)</option>
              <option value="co2">co2 (Carbon dioxide ppm)</option>
            </select>
          </div>

          {/* Tampered Value */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Injected Tamper Value
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.1"
                value={tamperedValue}
                onChange={(e) => setTamperedValue(parseFloat(e.target.value) || 0)}
                className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-rose-600 focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={handleSimulateTamper}
            disabled={isLoading || !selectedBatch}
            className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition-colors disabled:opacity-50"
          >
            <Zap className="w-4 h-4" />
            <span>1. Inject Database Tampering (Attack)</span>
          </button>

          <button
            onClick={handleVerifyBatch}
            disabled={isLoading || !selectedBatch}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition-colors disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>2. Run Cryptographic Blockchain Verification</span>
          </button>

          <button
            onClick={handleRestoreIntegrity}
            disabled={isLoading || !selectedBatch}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition-colors disabled:opacity-50 ml-auto"
          >
            <Wrench className="w-4 h-4 text-white" />
            <span>3. Restore Data Integrity</span>
          </button>
        </div>

        {/* Attack Status & Discrepancy Display */}
        {verificationResult && (
          <div
            className={`p-4 rounded-xl border text-xs space-y-3 transition-all ${
              verificationResult.verified
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-300 text-rose-950'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {verificationResult.verified ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-bold text-sm">
                  {verificationResult.verified ? '✓ Data Integrity Confirmed' : '⚠ Cryptographic Tamper Detected!'}
                </p>
                <p className="mt-0.5 opacity-90">{verificationResult.message}</p>
              </div>
            </div>

            {/* Hash Comparison Matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 font-mono text-[11px]">
              <div className="bg-white/80 p-3 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-[10px] text-slate-500 uppercase font-sans font-semibold block">
                  Calculated MySQL Merkle Root:
                </span>
                <span className={`break-all font-bold ${verificationResult.verified ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {verificationResult.calculatedRoot}
                </span>
              </div>
              <div className="bg-white/80 p-3 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-[10px] text-slate-500 uppercase font-sans font-semibold block">
                  Immutable Hyperledger Fabric Root:
                </span>
                <span className="break-all font-bold text-indigo-700">
                  {verificationResult.blockchainRoot}
                </span>
              </div>
            </div>

            {/* Tampered Records List */}
            {verificationResult.tamperedRecords && verificationResult.tamperedRecords.length > 0 && (
              <div className="bg-rose-100/80 p-3 rounded-lg border border-rose-200 text-rose-900">
                <span className="font-bold text-xs block mb-1">Detected Altered Records:</span>
                <ul className="list-disc list-inside space-y-1 text-[11px]">
                  {verificationResult.tamperedRecords.map((tr, idx) => (
                    <li key={idx}>
                      <span className="font-semibold">Log #{tr.logId || tr.sequenceNumber}:</span> {tr.reason || 'Record hash mismatch'} (Temp: {tr.temperature}°C, Hum: {tr.humidity}%)
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
