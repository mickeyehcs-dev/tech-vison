import { executeQuery } from '../connection';
import { BlockchainBatch, BlockchainVerification, EnvBindings, BlockchainBatchStatus, BatchType } from '../../types';
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { formatMySqlDateTime } from '../../utils/datetime';

export class BlockchainRepository {
  static async createBatch(
    batch: {
      batch_id: string;
      delivery_id: number;
      device_id: string;
      start_sequence: number;
      end_sequence: number;
      record_count: number;
      start_time: string;
      end_time: string;
      merkle_root: string;
      blockchain_tx_id: string;
      block_number: number;
      blockchain_status?: BlockchainBatchStatus;
      batch_type?: BatchType;
      tamper_event_type?: string | null;
      metadata_json?: any;
    },
    env?: EnvBindings
  ): Promise<number> {
    const result = await executeQuery<ResultSetHeader>(
      `INSERT INTO blockchain_batches 
       (batch_id, delivery_id, device_id, start_sequence, end_sequence, record_count, start_time, end_time, merkle_root, blockchain_tx_id, block_number, blockchain_status, batch_type, tamper_event_type, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        batch.batch_id,
        batch.delivery_id,
        batch.device_id,
        batch.start_sequence,
        batch.end_sequence,
        batch.record_count,
        formatMySqlDateTime(batch.start_time),
        formatMySqlDateTime(batch.end_time),
        batch.merkle_root,
        batch.blockchain_tx_id,
        batch.block_number,
        batch.blockchain_status || 'ANCHORED',
        batch.batch_type || 'PERIODIC_HOURLY',
        batch.tamper_event_type || null,
        batch.metadata_json ? JSON.stringify(batch.metadata_json) : null
      ],
      env
    );
    return result.insertId;
  }

  static async findBatchById(batchId: string, env?: EnvBindings): Promise<BlockchainBatch | null> {
    const rows = await executeQuery<RowDataPacket[]>(
      `SELECT bb.*, d.delivery_code, d.food_name, u.full_name as driver_name
       FROM blockchain_batches bb
       LEFT JOIN deliveries d ON bb.delivery_id = d.id
       LEFT JOIN users u ON d.driver_id = u.id
       WHERE bb.batch_id = ?
       LIMIT 1`,
      [batchId.trim()],
      env
    );
    if (!rows[0]) return null;
    return rows[0] as BlockchainBatch;
  }

  static async listBatches(
    params: {
      deliveryId?: number;
      status?: string;
      page?: number;
      limit?: number;
    },
    env?: EnvBindings
  ): Promise<{ batches: BlockchainBatch[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const values: any[] = [];

    if (params.deliveryId) {
      conditions.push('bb.delivery_id = ?');
      values.push(params.deliveryId);
    }

    if (params.status) {
      conditions.push('bb.blockchain_status = ?');
      values.push(params.status);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countRows = await executeQuery<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM blockchain_batches bb ${whereClause}`,
      values,
      env
    );
    const total = countRows[0]?.count || 0;

    const querySql = `
      SELECT bb.*, d.delivery_code, d.food_name, u.full_name as driver_name
      FROM blockchain_batches bb
      LEFT JOIN deliveries d ON bb.delivery_id = d.id
      LEFT JOIN users u ON d.driver_id = u.id
      ${whereClause}
      ORDER BY bb.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const rows = await executeQuery<RowDataPacket[]>(
      querySql,
      [...values, limit, offset],
      env
    );

    return {
      batches: rows as BlockchainBatch[],
      total,
      page,
      limit
    };
  }

  static async getLatestBatchForDelivery(deliveryId: number, env?: EnvBindings): Promise<BlockchainBatch | null> {
    const rows = await executeQuery<RowDataPacket[]>(
      `SELECT bb.*, d.delivery_code, d.food_name
       FROM blockchain_batches bb
       LEFT JOIN deliveries d ON bb.delivery_id = d.id
       WHERE bb.delivery_id = ?
       ORDER BY bb.end_sequence DESC, bb.id DESC
       LIMIT 1`,
      [deliveryId],
      env
    );
    return (rows[0] as BlockchainBatch) || null;
  }

  static async getAllBatchesForDelivery(deliveryId: number, env?: EnvBindings): Promise<BlockchainBatch[]> {
    const rows = await executeQuery<RowDataPacket[]>(
      `SELECT bb.*, d.delivery_code, d.food_name
       FROM blockchain_batches bb
       LEFT JOIN deliveries d ON bb.delivery_id = d.id
       WHERE bb.delivery_id = ?
       ORDER BY bb.start_sequence ASC`,
      [deliveryId],
      env
    );
    return rows as BlockchainBatch[];
  }

  static async updateBatchStatus(
    batchId: string,
    status: BlockchainBatchStatus,
    verifiedAt?: string | null,
    env?: EnvBindings
  ): Promise<boolean> {
    const result = await executeQuery<ResultSetHeader>(
      `UPDATE blockchain_batches 
       SET blockchain_status = ?, verified_at = ? 
       WHERE batch_id = ?`,
      [status, verifiedAt ? formatMySqlDateTime(verifiedAt) : null, batchId],
      env
    );
    return result.affectedRows > 0;
  }

  static async logVerification(
    verification: {
      batch_id: string;
      delivery_id: number;
      status: 'VALID' | 'TAMPERED' | 'ERROR';
      calculated_merkle_root: string;
      blockchain_merkle_root: string;
      hash_chain_valid: boolean;
      tampered_record_count: number;
      details_json?: any;
      verified_by?: string;
    },
    env?: EnvBindings
  ): Promise<number> {
    const result = await executeQuery<ResultSetHeader>(
      `INSERT INTO blockchain_verifications 
       (batch_id, delivery_id, status, calculated_merkle_root, blockchain_merkle_root, hash_chain_valid, tampered_record_count, details_json, verified_by, verified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        verification.batch_id,
        verification.delivery_id,
        verification.status,
        verification.calculated_merkle_root,
        verification.blockchain_merkle_root,
        verification.hash_chain_valid ? 1 : 0,
        verification.tampered_record_count,
        verification.details_json ? JSON.stringify(verification.details_json) : null,
        verification.verified_by || 'SYSTEM_AUDITOR'
      ],
      env
    );
    return result.insertId;
  }

  static async getVerificationsByDelivery(deliveryId: number, env?: EnvBindings): Promise<BlockchainVerification[]> {
    const rows = await executeQuery<RowDataPacket[]>(
      `SELECT * FROM blockchain_verifications WHERE delivery_id = ? ORDER BY verified_at DESC LIMIT 50`,
      [deliveryId],
      env
    );
    return rows as BlockchainVerification[];
  }

  static async getVerificationsByBatch(batchId: string, env?: EnvBindings): Promise<BlockchainVerification[]> {
    const rows = await executeQuery<RowDataPacket[]>(
      `SELECT * FROM blockchain_verifications WHERE batch_id = ? ORDER BY verified_at DESC LIMIT 20`,
      [batchId],
      env
    );
    return rows as BlockchainVerification[];
  }
}
