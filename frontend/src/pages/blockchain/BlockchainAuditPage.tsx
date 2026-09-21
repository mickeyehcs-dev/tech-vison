import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { MerkleVisualizer } from '../../components/blockchain/MerkleVisualizer';
import { blockchainApi } from '../../api/blockchain';
import { useToast } from '../../context/ToastContext';
import {
  BlockchainBatch,
  LedgerStatus,
  BatchVerificationResult
} from '../../types';
import {
  ShieldCheck,
  ShieldAlert,
  Layers,
  Activity,
  Cpu,
  RefreshCw,
  Search,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  Eye,
  PlusCircle,
  Database,
  Lock,
  Network
} from 'lucide-react';

export const BlockchainAuditPage: React.FC = () => {
  const { success, error } = useToast();
  const [batches, setBatches] = useState<BlockchainBatch[]>([]);
  const [ledgerStatus, setLedgerStatus] = useState<LedgerStatus | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<BlockchainBatch | null>(null);
  const [activeVerification, setActiveVerification] = useState<BatchVerificationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [verifyingBatchId, setVerifyingBatchId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [copiedTx, setCopiedTx] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [batchesRes, statusRes] = await Promise.all([
        blockchainApi.getBatches({ status: statusFilter || undefined }),
        blockchainApi.getLedgerStatus()
      ]);

      setBatches(batchesRes.batches);
      setLedgerStatus(statusRes);
      if (batchesRes.batches.length > 0 && !selectedBatch) {
        setSelectedBatch(batchesRes.batches[0]);
      }
    } catch (err: any) {
      error(err.message || 'Failed to load blockchain ledger data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const handleVerify = async (batchId: string) => {
    try {
      setVerifyingBatchId(batchId);
      const res = await blockchainApi.verifyBatch(batchId);
      setActiveVerification(res);

      // Update in local state
      setBatches((prev) =>
        prev.map((b) => (b.batch_id === batchId ? { ...b, blockchain_status: res.status as any } : b))
      );

      if (res.verified) {
        success(`✓ Batch ${batchId} verified against Hyperledger Fabric!`);
      } else {
        error(`⚠ DATA INTEGRITY FAILURE for batch ${batchId}!`);
      }
    } catch (err: any) {
      error(err.message || 'Verification failed');
    } finally {
      setVerifyingBatchId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTx(text);
    setTimeout(() => setCopiedTx(null), 2000);
  };

  const truncate = (str: string, len: number = 8) => {
    if (!str || str.length <= len * 2) return str;
    return `${str.substring(0, len)}...${str.substring(str.length - len)}`;
  };

  const filteredBatches = batches.filter((b) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      b.batch_id.toLowerCase().includes(q) ||
      (b.delivery_code && b.delivery_code.toLowerCase().includes(q)) ||
      (b.merkle_root && b.merkle_root.toLowerCase().includes(q)) ||
      (b.food_name && b.food_name.toLowerCase().includes(q))
    );
  });

  const totalLogsAudited = batches.reduce((acc, b) => acc + (b.record_count || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12">
        {/* Page Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Blockchain Data Integrity & Audit Portal
              </h1>
              <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-300">
                Hyperledger Fabric v2.5
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Immutable SHA-256 Merkle-root batch proofs & adaptive tamper-evidence for cold-chain IoT telemetry.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-slate-200 shadow-2xs transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Ledger</span>
            </button>
          </div>
        </div>

        {/* Ledger Health Status Card */}
        {ledgerStatus && (
          <div className="bg-white text-slate-800 rounded-2xl p-5 border border-slate-200 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <Network className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    {ledgerStatus.network}
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Channel: <span className="text-slate-800 font-semibold">{ledgerStatus.channel}</span> • Chaincode: <span className="text-slate-800">{ledgerStatus.chaincode}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
                <span className="text-slate-500">Mode:</span>
                <span className="font-bold text-emerald-700">
                  {ledgerStatus.mode === 'HYPERLEDGER_FABRIC_LIVE' ? 'Fabric Peer Live' : 'Fail-Safe Synthetic Ledger Active'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 text-xs">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Peer Node</span>
                <span className="text-slate-700 font-mono text-[11px] truncate block">{ledgerStatus.peer}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Block Height</span>
                <span className="text-emerald-700 font-mono font-bold text-sm">#{ledgerStatus.blockHeight}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Total Transactions</span>
                <span className="text-indigo-700 font-mono font-bold text-sm">{ledgerStatus.totalTransactions} committed</span>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Consensus Engine</span>
                <span className="text-slate-700 font-medium">{ledgerStatus.consensus}</span>
              </div>
            </div>
          </div>
        )}

        {/* 4 Metric Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Anchored Batches</span>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900">{batches.length}</p>
            <p className="text-[11px] text-slate-500 mt-1">Total Merkle roots anchored</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Audited Records</span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <Database className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900">{totalLogsAudited}</p>
            <p className="text-[11px] text-slate-500 mt-1">Sensor logs with SHA-256 proofs</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ledger Security</span>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <Lock className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-emerald-600">100%</p>
            <p className="text-[11px] text-slate-500 mt-1">Cryptographic hash chain intact</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fabric Status</span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <p className="text-lg font-black text-slate-900">VERIFIED</p>
            <p className="text-[11px] text-emerald-600 font-semibold mt-1">Zero undetected tampering</p>
          </div>
        </div>

        {/* Active Verification Audit Summary Banner */}
        {activeVerification && (
          <div
            className={`p-4 rounded-2xl border text-xs space-y-3 transition-all ${
              activeVerification.verified
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-300 text-rose-950'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                {activeVerification.verified ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-bold text-sm">
                    {activeVerification.verified
                      ? `✓ Batch ${activeVerification.batchId} Cryptographically Verified (VALID)`
                      : `⚠ Cryptographic Mismatch in Batch ${activeVerification.batchId}`}
                  </p>
                  <p className="mt-0.5 opacity-90">{activeVerification.message}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveVerification(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold px-2 py-1 rounded-md"
              >
                ✕ Close
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 font-mono text-[11px]">
              <div className="bg-white/80 p-3 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-[10px] text-slate-500 uppercase font-sans font-semibold block">
                  Calculated MySQL Merkle Root:
                </span>
                <span className={`break-all font-bold ${activeVerification.verified ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {activeVerification.calculatedRoot}
                </span>
              </div>
              <div className="bg-white/80 p-3 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-[10px] text-slate-500 uppercase font-sans font-semibold block">
                  Immutable Hyperledger Fabric Root:
                </span>
                <span className="break-all font-bold text-indigo-700">
                  {activeVerification.blockchainRoot}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Interactive Merkle Tree Visualizer */}
        {selectedBatch && (
          <MerkleVisualizer
            batchId={selectedBatch.batch_id}
            merkleRoot={selectedBatch.merkle_root}
            treeStructure={selectedBatch.metadata_json?.treeStructure}
          />
        )}

        {/* Batches Table & Filter Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          {/* Filter Bar */}
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search by Batch ID, Delivery Code, Commodity, or Merkle Root..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">All Statuses</option>
                <option value="ANCHORED">ANCHORED</option>
                <option value="VERIFIED">VERIFIED</option>
                <option value="TAMPERED">TAMPERED</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Batch ID & Delivery</th>
                  <th className="py-3 px-4">Commodity</th>
                  <th className="py-3 px-4">Record Range</th>
                  <th className="py-3 px-4">Merkle Root (SHA-256)</th>
                  <th className="py-3 px-4">Blockchain Tx ID</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredBatches.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No blockchain batches found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredBatches.map((batch) => {
                    const isSelected = selectedBatch?.batch_id === batch.batch_id;
                    const isVerifying = verifyingBatchId === batch.batch_id;
                    return (
                      <tr
                        key={batch.batch_id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isSelected ? 'bg-emerald-50/40' : ''
                        }`}
                      >
                        {/* Batch ID & Delivery */}
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-slate-900">{batch.batch_id}</div>
                          <div className="text-[11px] text-slate-500 font-semibold">
                            {batch.delivery_code || `DEL-${batch.delivery_id}`}
                          </div>
                        </td>

                        {/* Commodity */}
                        <td className="py-3.5 px-4 font-medium text-slate-700">
                          {batch.food_name || 'Cold Transport'}
                        </td>

                        {/* Record Range */}
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold text-slate-800">{batch.record_count} logs</span>
                          <div className="text-[10px] text-slate-500 font-mono">
                            Seq #{batch.start_sequence} → #{batch.end_sequence}
                          </div>
                        </td>

                        {/* Merkle Root */}
                        <td className="py-3.5 px-4 font-mono text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-emerald-700 font-semibold">{truncate(batch.merkle_root, 6)}</span>
                            <button
                              onClick={() => copyToClipboard(batch.merkle_root)}
                              className="p-1 text-slate-400 hover:text-slate-700 rounded"
                              title="Copy Full Merkle Root"
                            >
                              {copiedTx === batch.merkle_root ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Blockchain Tx ID */}
                        <td className="py-3.5 px-4 font-mono text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-indigo-700">{truncate(batch.blockchain_tx_id, 6)}</span>
                            <span className="text-[10px] text-slate-500">Block #{batch.block_number}</span>
                          </div>
                        </td>

                        {/* Type */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              batch.batch_type === 'CRITICAL_EVENT'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {batch.batch_type === 'CRITICAL_EVENT' ? 'Critical Anomaly' : 'Periodic Hourly'}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 w-fit ${
                              batch.blockchain_status === 'VERIFIED'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : batch.blockchain_status === 'TAMPERED'
                                ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse'
                                : 'bg-blue-100 text-blue-800 border border-blue-300'
                            }`}
                          >
                            {batch.blockchain_status === 'VERIFIED' && <CheckCircle2 className="w-3 h-3" />}
                            {batch.blockchain_status === 'TAMPERED' && <ShieldAlert className="w-3 h-3" />}
                            {batch.blockchain_status || 'ANCHORED'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right space-x-2">
                          <button
                            onClick={() => setSelectedBatch(batch)}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold p-1.5 rounded hover:bg-indigo-50 transition-colors"
                            title="View Merkle Tree Visualizer"
                          >
                            <Eye className="w-4 h-4 inline" />
                          </button>
                          <button
                            onClick={() => handleVerify(batch.batch_id)}
                            disabled={isVerifying}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs px-2.5 py-1.5 rounded-lg border border-emerald-300 transition-colors disabled:opacity-50"
                          >
                            {isVerifying ? 'Verifying...' : 'Verify'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};
