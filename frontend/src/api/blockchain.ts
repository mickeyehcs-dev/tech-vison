import { apiClient } from './client';
import {
  BlockchainBatch,
  BatchVerificationResult,
  LedgerStatus,
  BlockchainVerification
} from '../types';

export const blockchainApi = {
  /**
   * Fetch paginated list of blockchain batches
   */
  async getBatches(params?: {
    delivery_id?: number;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ batches: BlockchainBatch[]; meta?: any }> {
    const query = new URLSearchParams();
    if (params?.delivery_id) query.append('delivery_id', String(params.delivery_id));
    if (params?.status) query.append('status', params.status);
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));

    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await apiClient.get<BlockchainBatch[]>(`/blockchain/batches${qs}`);
    return {
      batches: res.data || [],
      meta: res.meta
    };
  },

  /**
   * Fetch single batch details including Merkle tree levels & proofs
   */
  async getBatchDetails(batchId: string): Promise<BlockchainBatch> {
    const res = await apiClient.get<BlockchainBatch>(`/blockchain/batches/${encodeURIComponent(batchId)}`);
    return res.data;
  },

  /**
   * Manually trigger creation of a new Merkle batch proof and anchor to Fabric
   */
  async anchorBatch(
    deliveryId: number,
    options?: { batch_type?: string; reason?: string; min_records?: number }
  ): Promise<{ message: string; batch: BlockchainBatch | null }> {
    const res = await apiClient.post<{ message: string; batch: BlockchainBatch | null }>(
      `/blockchain/anchor/${deliveryId}`,
      options || {}
    );
    return res.data;
  },

  /**
   * Cryptographically verify a batch against Hyperledger Fabric
   */
  async verifyBatch(batchId: string): Promise<BatchVerificationResult> {
    const res = await apiClient.post<BatchVerificationResult>(
      `/blockchain/verify/${encodeURIComponent(batchId)}`
    );
    return res.data;
  },

  /**
   * Cryptographically verify all batches for a shipment
   */
  async verifyDelivery(deliveryId: number): Promise<{
    deliveryId: number;
    totalBatches: number;
    allValid: boolean;
    overallStatus: 'VALID' | 'TAMPERED';
    batchResults: BatchVerificationResult[];
    verifiedAt: string;
  }> {
    const res = await apiClient.post<any>(`/blockchain/verify-delivery/${deliveryId}`);
    return res.data;
  },

  /**
   * Fetch complete blockchain history for a delivery
   */
  async getShipmentHistory(deliveryId: number): Promise<{
    deliveryId: number;
    onChainHistory: any[];
    databaseBatches: BlockchainBatch[];
    verifications: BlockchainVerification[];
  }> {
    const res = await apiClient.get<any>(`/blockchain/history/${deliveryId}`);
    return res.data;
  },

  /**
   * Fetch Hyperledger Fabric & Synthetic Ledger network health
   */
  async getLedgerStatus(): Promise<LedgerStatus> {
    const res = await apiClient.get<LedgerStatus>('/blockchain/ledger-status');
    return res.data;
  },

  /**
   * Tamper Simulation Attack Sandbox
   */
  async simulateTamper(params: {
    delivery_id: number;
    log_id?: number;
    field?: string;
    new_value?: number;
  }): Promise<{ success: boolean; modifiedLogId: number; originalValue: any; tamperedValue: any; message: string }> {
    const res = await apiClient.post<any>('/blockchain/simulate-tamper', params);
    return res.data;
  },

  /**
   * Restore database integrity after tamper simulation
   */
  async restoreTamper(deliveryId: number): Promise<{ success: boolean; message: string }> {
    const res = await apiClient.post<any>('/blockchain/restore-tamper', { delivery_id: deliveryId });
    return res.data;
  }
};
