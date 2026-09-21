import React, { useState } from 'react';
import { MerkleTreeStructure } from '../../types';
import { Copy, Check, ShieldCheck, Database, Layers, Network } from 'lucide-react';

interface MerkleVisualizerProps {
  treeStructure?: MerkleTreeStructure;
  merkleRoot: string;
  batchId?: string;
  tamperedLeafIndex?: number;
}

export const MerkleVisualizer: React.FC<MerkleVisualizerProps> = ({
  treeStructure,
  merkleRoot,
  batchId,
  tamperedLeafIndex
}) => {
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const copyToClipboard = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const truncate = (hash: string, len: number = 8) => {
    if (!hash || hash.length <= len * 2) return hash;
    return `${hash.substring(0, len)}...${hash.substring(hash.length - len)}`;
  };

  const levels = treeStructure?.levels || [[merkleRoot]];
  const leaves = treeStructure?.leaves || [];

  return (
    <div className="bg-white text-slate-800 rounded-2xl p-6 border border-slate-200 shadow-2xs overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              Cryptographic Merkle Tree Structure
              <span className="text-[10px] uppercase tracking-wider font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                SHA-256 Binary Tree
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Batch: <span className="text-slate-800 font-mono font-medium">{batchId || 'Current Batch'}</span> • {leaves.length} Leaf Records • Depth {levels.length}
            </p>
          </div>
        </div>

        {/* Root Badge */}
        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="text-slate-500 font-medium">Merkle Root:</span>
          <span className="font-mono text-slate-900 font-bold">{truncate(merkleRoot, 6)}</span>
          <button
            onClick={() => copyToClipboard(merkleRoot)}
            className="p-1 hover:text-slate-900 text-slate-400 rounded transition-colors"
            title="Copy Full Merkle Root"
          >
            {copiedHash === merkleRoot ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Visual Tree Levels */}
      <div className="py-6 flex flex-col items-center gap-6 overflow-x-auto">
        {/* Level 0: Merkle Root */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-600" /> Top-Level Merkle Root (Anchored on Hyperledger Fabric)
          </span>
          <div className="relative group bg-gradient-to-r from-emerald-50/90 to-slate-50 border-2 border-emerald-500/40 hover:border-emerald-500 p-3 rounded-xl shadow-xs text-center transition-all">
            <div className="font-mono text-xs text-emerald-900 font-bold break-all flex items-center justify-center gap-2">
              <span>{merkleRoot}</span>
              <button
                onClick={() => copyToClipboard(merkleRoot)}
                className="p-1 hover:text-slate-900 text-slate-400"
              >
                {copiedHash === merkleRoot ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-emerald-700 font-medium mt-1">Immutable Root Digest • 256-bit Cryptographic Proof</p>
          </div>
        </div>

        {/* Tree Connectors & Intermediate Levels */}
        {levels.length > 2 && (
          <div className="flex flex-col items-center gap-4 w-full">
            <div className="w-0.5 h-4 bg-slate-200" />
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1">
              <Layers className="w-3 h-3 text-blue-600" /> Intermediate Parent Hashes
            </span>
            <div className="flex flex-wrap justify-center gap-3 max-w-full">
              {levels[levels.length - 2].map((nodeHash, idx) => (
                <div
                  key={`inter-${idx}`}
                  className="bg-slate-50 border border-slate-200 hover:border-blue-400 px-3 py-2 rounded-lg text-center font-mono text-[11px] text-blue-700 shadow-2xs transition-all"
                >
                  <span className="text-[9px] text-slate-400 block uppercase font-semibold">Node H_{levels.length - 2}_{idx}</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="font-bold">{truncate(nodeHash, 6)}</span>
                    <button
                      onClick={() => copyToClipboard(nodeHash)}
                      className="p-0.5 text-slate-400 hover:text-blue-700"
                    >
                      {copiedHash === nodeHash ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Level: Leaf Hashes (Individual Telemetry Records) */}
        <div className="flex flex-col items-center gap-3 w-full pt-2">
          <div className="w-0.5 h-4 bg-slate-200" />
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1">
            <Database className="w-3 h-3 text-amber-600" /> Base Leaf Nodes (SHA-256 Sensor Record Hashes)
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
            {leaves.map((leafHash, idx) => {
              const isTampered = tamperedLeafIndex !== undefined && tamperedLeafIndex === idx;
              return (
                <div
                  key={`leaf-${idx}`}
                  className={`p-3 rounded-xl border font-mono text-xs transition-all ${
                    isTampered
                      ? 'bg-rose-50 border-rose-300 text-rose-900 ring-2 ring-rose-400'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                    <span className="font-semibold text-slate-700">Leaf #{idx + 1}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${isTampered ? 'bg-rose-100 text-rose-700 font-bold' : 'bg-slate-200/70 text-slate-600'}`}>
                      {isTampered ? 'TAMPERED' : 'RECORD HASH'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1 text-[11px]">
                    <span className="truncate font-medium">{truncate(leafHash, 8)}</span>
                    <button
                      onClick={() => copyToClipboard(leafHash)}
                      className="p-1 text-slate-400 hover:text-slate-700"
                    >
                      {copiedHash === leafHash ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 font-sans mt-1">
                    H_{idx + 1} = SHA256(Record_{idx + 1} + H_{idx})
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-4 pt-4 border-t border-slate-100 text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>Cryptographic Hash Chain: Linked via H_n = SHA256(Record_n + H_n-1)</span>
        </div>
        <span className="text-slate-500 font-mono">Algorithm: NIST FIPS 180-4 SHA-256</span>
      </div>
    </div>
  );
};
