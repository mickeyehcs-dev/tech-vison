import { Hono } from 'hono';
import { BlockchainRepository } from '../db/repositories/BlockchainRepository';
import { BlockchainBatchService } from '../services/blockchain/BlockchainBatchService';
import { FabricClient } from '../services/blockchain/FabricClient';
import { authMiddleware } from '../middleware/authMiddleware';
import { successResponse, errorResponse } from '../utils/response';
import { AppEnv } from '../types';

const blockchainRoutes = new Hono<AppEnv>();

// ========================================================
// 1. PUBLIC / AUTHENTICATED BATCH PROOFS & VERIFICATION
// ========================================================

/**
 * GET /api/v1/blockchain/batches
 * List anchored blockchain batches with optional filters.
 */
blockchainRoutes.get('/batches', async (c) => {
  try {
    const deliveryIdStr = c.req.query('delivery_id') || c.req.query('deliveryId');
    const deliveryId = deliveryIdStr ? parseInt(deliveryIdStr, 10) : undefined;
    const status = c.req.query('status');
    const page = parseInt(c.req.query('page') || '1', 10);
    const limit = parseInt(c.req.query('limit') || '20', 10);

    const result = await BlockchainRepository.listBatches({ deliveryId, status, page, limit }, c.env);

    return successResponse(c, result.batches, 200, {
      total: result.total,
      page: result.page,
      limit: result.limit
    });
  } catch (err: any) {
    return errorResponse(c, err.message, 500);
  }
});

/**
 * GET /api/v1/blockchain/batches/:batchId
 * Fetch detailed on-chain proof and Merkle tree structure for a batch.
 */
blockchainRoutes.get('/batches/:batchId', async (c) => {
  try {
    const batchId = c.req.param('batchId');
    if (!batchId) {
      return errorResponse(c, 'batchId is required', 400);
    }
    const batch = await BlockchainRepository.findBatchById(batchId, c.env);
    if (!batch) {
      return errorResponse(c, `Blockchain batch ${batchId} not found`, 404);
    }

    const onChainProof = await FabricClient.getBatchProof(batchId, c.env);
    const verifications = await BlockchainRepository.getVerificationsByBatch(batchId, c.env);

    return successResponse(c, {
      ...batch,
      onChainProof,
      verifications
    });
  } catch (err: any) {
    return errorResponse(c, err.message, 500);
  }
});

/**
 * POST /api/v1/blockchain/anchor/:deliveryId
 * Manually trigger creation of a new batch proof and submit to Hyperledger Fabric.
 */
blockchainRoutes.post('/anchor/:deliveryId', authMiddleware, async (c) => {
  try {
    const deliveryId = parseInt(c.req.param('deliveryId') || '0', 10);
    const body = await c.req.json().catch(() => ({}));

    const batch = await BlockchainBatchService.anchorPendingRecords(
      deliveryId,
      {
        batchType: body.batch_type || 'MANUAL_TRIGGER',
        triggerReason: body.reason || 'Manual user anchor trigger',
        minRecords: body.min_records !== undefined ? body.min_records : 1
      },
      c.env
    );

    if (!batch) {
      return successResponse(c, {
        message: 'No unanchored sensor records available for batch creation.',
        batch: null
      });
    }

    return successResponse(c, {
      message: `Batch ${batch.batch_id} successfully anchored to Hyperledger Fabric!`,
      batch
    }, 201);
  } catch (err: any) {
    return errorResponse(c, err.message, 400);
  }
});

/**
 * POST /api/v1/blockchain/verify/:batchId
 * Cryptographically verifies batch records from MySQL against the Hyperledger Fabric ledger.
 */
blockchainRoutes.post('/verify/:batchId', async (c) => {
  try {
    const batchId = c.req.param('batchId');
    if (!batchId) {
      return errorResponse(c, 'batchId is required', 400);
    }
    const result = await BlockchainBatchService.verifyBatch(batchId, c.env);

    return successResponse(c, result, result.verified ? 200 : 200);
  } catch (err: any) {
    return errorResponse(c, err.message, 400);
  }
});

/**
 * POST /api/v1/blockchain/verify-delivery/:deliveryId
 * Cryptographically verifies all batches associated with a delivery.
 */
blockchainRoutes.post('/verify-delivery/:deliveryId', async (c) => {
  try {
    const deliveryId = parseInt(c.req.param('deliveryId') || '0', 10);
    const result = await BlockchainBatchService.verifyAllBatchesForDelivery(deliveryId, c.env);

    return successResponse(c, result);
  } catch (err: any) {
    return errorResponse(c, err.message, 400);
  }
});

/**
 * GET /api/v1/blockchain/history/:deliveryId
 * Retrieves on-chain audit trail history for a shipment.
 */
blockchainRoutes.get('/history/:deliveryId', async (c) => {
  try {
    const deliveryId = parseInt(c.req.param('deliveryId') || '0', 10);
    const history = await FabricClient.getShipmentHistory(deliveryId, c.env);
    const batches = await BlockchainRepository.getAllBatchesForDelivery(deliveryId, c.env);
    const verifications = await BlockchainRepository.getVerificationsByDelivery(deliveryId, c.env);

    return successResponse(c, {
      deliveryId,
      onChainHistory: history,
      databaseBatches: batches,
      verifications
    });
  } catch (err: any) {
    return errorResponse(c, err.message, 500);
  }
});

/**
 * GET /api/v1/blockchain/ledger-status
 * Health check & topology for Hyperledger Fabric network & Synthetic ledger.
 */
blockchainRoutes.get('/ledger-status', async (c) => {
  try {
    const status = FabricClient.getLedgerStatus(c.env);
    return successResponse(c, status);
  } catch (err: any) {
    return errorResponse(c, err.message, 500);
  }
});

/**
 * POST /api/v1/blockchain/simulate-tamper
 * Demonstration & testing tool: Injects a deliberate modification in MySQL sensor records
 * without updating the blockchain proof to demonstrate real-time tamper detection in the UI.
 */
blockchainRoutes.post('/simulate-tamper', async (c) => {
  try {
    const body = await c.req.json();
    const deliveryId = parseInt(body.delivery_id || body.deliveryId, 10);
    const logId = body.log_id ? parseInt(body.log_id, 10) : undefined;
    const field = body.field || 'temperature';
    const newValue = body.new_value !== undefined ? Number(body.new_value) : 28.5;

    if (!deliveryId) {
      return errorResponse(c, 'delivery_id is required', 400);
    }

    const result = await BlockchainBatchService.simulateDatabaseTamper(deliveryId, logId, field, newValue, c.env);
    return successResponse(c, result);
  } catch (err: any) {
    return errorResponse(c, err.message, 400);
  }
});

/**
 * POST /api/v1/blockchain/restore-tamper
 * Restores original database values after running tamper simulations.
 */
blockchainRoutes.post('/restore-tamper', async (c) => {
  try {
    const body = await c.req.json();
    const deliveryId = parseInt(body.delivery_id || body.deliveryId, 10);

    if (!deliveryId) {
      return errorResponse(c, 'delivery_id is required', 400);
    }

    const result = await BlockchainBatchService.restoreTamperedData(deliveryId, c.env);
    return successResponse(c, result);
  } catch (err: any) {
    return errorResponse(c, err.message, 400);
  }
});

export { blockchainRoutes };
