import { SensorRepository } from '../../db/repositories/SensorRepository';
import { DeliveryRepository } from '../../db/repositories/DeliveryRepository';
import { BlockchainRepository } from '../../db/repositories/BlockchainRepository';
import { FabricClient } from './FabricClient';
import { MerkleTree, computeSensorRecordHash, GENESIS_PREVIOUS_HASH } from './MerkleTree';
import { SecurityService } from '../SecurityService';
import { NotificationService } from '../NotificationService';
import { BlockchainBatch, EnvBindings, BatchType, BlockchainBatchStatus, SensorLog } from '../../types';

export class BlockchainBatchService {
  /**
   * Batches unanchored sensor telemetry readings for a delivery and anchors the Merkle root on blockchain.
   */
  static async anchorPendingRecords(
    deliveryId: number,
    options: {
      batchType?: BatchType;
      triggerReason?: string;
      minRecords?: number;
    } = {},
    env?: EnvBindings
  ): Promise<BlockchainBatch | null> {
    const delivery = await DeliveryRepository.findById(deliveryId, env);
    if (!delivery) {
      throw new Error(`Delivery #${deliveryId} not found.`);
    }

    const latestBatch = await BlockchainRepository.getLatestBatchForDelivery(deliveryId, env);
    const lastEndSeq = latestBatch ? latestBatch.end_sequence : 0;

    const unanchoredLogs = await SensorRepository.getUnanchoredLogs(deliveryId, lastEndSeq, env);
    const minRecords = options.minRecords !== undefined ? options.minRecords : 1;

    if (unanchoredLogs.length < minRecords) {
      return null;
    }

    // Ensure all logs have sequential hashes and valid record hashes
    const leafHashes: string[] = [];
    let previousHash = latestBatch ? latestBatch.merkle_root : GENESIS_PREVIOUS_HASH;

    for (let i = 0; i < unanchoredLogs.length; i++) {
      const log = unanchoredLogs[i];
      let hash = log.record_hash;

      if (!hash) {
        hash = await computeSensorRecordHash(
          {
            delivery_id: log.delivery_id,
            sensor_module_id: log.sensor_module_id,
            sequence_number: log.sequence_number,
            temperature: log.temperature,
            humidity: log.humidity,
            methane: log.methane,
            co2: log.co2,
            storage_hours: log.storage_hours,
            storage_days: log.storage_days,
            score: log.score,
            status: log.status,
            device_recorded_at: log.device_recorded_at
          },
          log.previous_hash || previousHash
        );
        // Persist computed hash if missing
        await SensorRepository.updateSensorLog(log.id, { record_hash: hash }, env);
      }

      leafHashes.push(hash);
      previousHash = hash;
    }

    // Build Merkle Tree
    const merkleTree = await MerkleTree.create(leafHashes);
    const merkleRoot = merkleTree.getRoot();

    const startSeq = unanchoredLogs[0].sequence_number;
    const endSeq = unanchoredLogs[unanchoredLogs.length - 1].sequence_number;
    const startTime = unanchoredLogs[0].recorded_at;
    const endTime = unanchoredLogs[unanchoredLogs.length - 1].recorded_at;
    const deviceId = unanchoredLogs[0].device_id || delivery.device_id || 'SFM-ESP32-CORE';

    const batchIndex = (latestBatch ? latestBatch.id : 0) + 1;
    const batchId = `BATCH-${delivery.delivery_code || `DEL-${deliveryId}`}-${String(batchIndex).padStart(3, '0')}`;

    // Submit transaction to Hyperledger Fabric / Synthetic Ledger
    const onChainResult = await FabricClient.recordBatchProof(
      {
        batchId,
        shipmentId: deliveryId,
        deviceId,
        recordCount: unanchoredLogs.length,
        startTime,
        endTime,
        merkleRoot,
        batchType: options.batchType || 'PERIODIC_HOURLY',
        tamperEventType: options.triggerReason || null
      },
      env
    );

    // Save batch record to database
    await BlockchainRepository.createBatch(
      {
        batch_id: batchId,
        delivery_id: deliveryId,
        device_id: deviceId,
        start_sequence: startSeq,
        end_sequence: endSeq,
        record_count: unanchoredLogs.length,
        start_time: startTime,
        end_time: endTime,
        merkle_root: merkleRoot,
        blockchain_tx_id: onChainResult.txId,
        block_number: onChainResult.blockNumber,
        blockchain_status: 'ANCHORED',
        batch_type: options.batchType || 'PERIODIC_HOURLY',
        tamper_event_type: options.triggerReason || null,
        metadata_json: {
          merkleDepth: merkleTree.getDepth(),
          leafCount: leafHashes.length,
          treeStructure: merkleTree.getStructure()
        }
      },
      env
    );

    // Audit log
    await SecurityService.logEvent(
      {
        userId: delivery.sender_id,
        email: delivery.sender_email || null,
        eventType: 'BLOCKCHAIN_BATCH_ANCHORED',
        success: true,
        details: {
          batchId,
          deliveryId,
          merkleRoot,
          recordCount: unanchoredLogs.length,
          txId: onChainResult.txId,
          blockNumber: onChainResult.blockNumber
        }
      },
      env
    );

    return BlockchainRepository.findBatchById(batchId, env);
  }

  /**
   * Adaptive Evidence Window: Immediately freezes unanchored readings and anchors an emergency proof
   * on the blockchain upon detection of critical threshold violations (e.g. temp spike, ethylene spike, GPS jump).
   */
  static async triggerEmergencyTamperAnchor(
    deliveryId: number,
    eventType: string,
    telemetryData: any,
    env?: EnvBindings
  ): Promise<BlockchainBatch | null> {
    const delivery = await DeliveryRepository.findById(deliveryId, env);
    if (!delivery) return null;

    const eventId = `EVT-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;

    // Anchor emergency batch
    const batch = await this.anchorPendingRecords(
      deliveryId,
      {
        batchType: 'CRITICAL_EVENT',
        triggerReason: eventType,
        minRecords: 1
      },
      env
    );

    // Anchor event on Fabric
    await FabricClient.recordTamperEvent(
      {
        eventId,
        shipmentId: deliveryId,
        deviceId: delivery.device_id || 'SFM-ESP32-CORE',
        eventType,
        merkleRoot: batch ? batch.merkle_root : '',
        details: telemetryData
      },
      env
    );

    // Notify stakeholders of on-chain emergency proof
    await NotificationService.sendNotification(
      {
        userId: delivery.sender_id,
        type: 'SECURITY_ALERT',
        title: `Blockchain Tamper-Evidence Proof Anchored (${eventType})`,
        message: `An emergency cryptographic Merkle root was immediately anchored to the blockchain for delivery #${delivery.delivery_code}. TxID: ${batch?.blockchain_tx_id || 'Generated'}`,
        data: { deliveryId, eventType, batchId: batch?.batch_id }
      },
      env
    );

    return batch;
  }

  /**
   * Verifies the cryptographic integrity of a batch by recalculating record hashes,
   * rebuilding the Merkle tree, and comparing with the immutable on-chain root.
   */
  static async verifyBatch(
    batchId: string,
    env?: EnvBindings
  ): Promise<{
    verified: boolean;
    status: 'VALID' | 'TAMPERED';
    message: string;
    batchId: string;
    deliveryId: number;
    calculatedRoot: string;
    blockchainRoot: string;
    blockchainTxId: string;
    blockNumber: number;
    recordCount: number;
    hashChainValid: boolean;
    tamperedRecords: any[];
    verifiedAt: string;
    treeStructure?: any;
  }> {
    const batch = await BlockchainRepository.findBatchById(batchId, env);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found.`);
    }

    // 1. Fetch all records included in this batch's sequence range
    const records = await SensorRepository.getLogsBySequenceRange(
      batch.delivery_id,
      batch.start_sequence,
      batch.end_sequence,
      env
    );

    if (records.length === 0) {
      const failMsg = `Critical Integrity Failure: 0 sensor records found in database for sequence range ${batch.start_sequence} - ${batch.end_sequence}. Records were deleted!`;
      await BlockchainRepository.logVerification(
        {
          batch_id: batchId,
          delivery_id: batch.delivery_id,
          status: 'TAMPERED',
          calculated_merkle_root: 'DELETED_RECORDS',
          blockchain_merkle_root: batch.merkle_root,
          hash_chain_valid: false,
          tampered_record_count: batch.record_count,
          details_json: { reason: 'Records deleted from database' }
        },
        env
      );
      await BlockchainRepository.updateBatchStatus(batchId, 'TAMPERED', new Date().toISOString(), env);

      return {
        verified: false,
        status: 'TAMPERED',
        message: failMsg,
        batchId,
        deliveryId: batch.delivery_id,
        calculatedRoot: 'DELETED_RECORDS',
        blockchainRoot: batch.merkle_root,
        blockchainTxId: batch.blockchain_tx_id,
        blockNumber: batch.block_number,
        recordCount: 0,
        hashChainValid: false,
        tamperedRecords: [{ sequence: batch.start_sequence, error: 'Records deleted from database' }],
        verifiedAt: new Date().toISOString()
      };
    }

    // 2. Recalculate each record's SHA-256 hash and verify hash chain continuity
    const calculatedLeafHashes: string[] = [];
    const tamperedRecords: any[] = [];
    let hashChainValid = true;

    // Determine initial previous hash (either previous batch root or genesis)
    let expectedPreviousHash = GENESIS_PREVIOUS_HASH;
    if (batch.start_sequence > 1) {
      const priorLog = await SensorRepository.getLogsBySequenceRange(
        batch.delivery_id,
        batch.start_sequence - 1,
        batch.start_sequence - 1,
        env
      );
      if (priorLog.length > 0 && priorLog[0].record_hash) {
        expectedPreviousHash = priorLog[0].record_hash;
      }
    }

    for (let i = 0; i < records.length; i++) {
      const log = records[i];
      const recalculatedHash = await computeSensorRecordHash(
        {
          delivery_id: log.delivery_id,
          sensor_module_id: log.sensor_module_id,
          sequence_number: log.sequence_number,
          temperature: log.temperature,
          humidity: log.humidity,
          methane: log.methane,
          co2: log.co2,
          storage_hours: log.storage_hours,
          storage_days: log.storage_days,
          score: log.score,
          status: log.status,
          device_recorded_at: log.device_recorded_at
        },
        log.previous_hash || expectedPreviousHash
      );

      // Check if stored hash differs from newly calculated hash (direct DB cell manipulation)
      if (log.record_hash && log.record_hash.toLowerCase() !== recalculatedHash.toLowerCase()) {
        hashChainValid = false;
        tamperedRecords.push({
          logId: log.id,
          sequenceNumber: log.sequence_number,
          temperature: log.temperature,
          humidity: log.humidity,
          storedHash: log.record_hash,
          recalculatedHash,
          reason: 'Payload modified in database (Hash Mismatch)'
        });
      }

      calculatedLeafHashes.push(recalculatedHash);
      expectedPreviousHash = recalculatedHash;
    }

    // 3. Rebuild Merkle Tree from calculated hashes
    const rebuiltTree = await MerkleTree.create(calculatedLeafHashes);
    const calculatedRoot = rebuiltTree.getRoot();

    // 4. Query on-chain proof from Hyperledger Fabric / Synthetic Ledger
    const onChainProof = await FabricClient.getBatchProof(batchId, env);
    const blockchainRoot = onChainProof ? onChainProof.merkleRoot : batch.merkle_root;

    // 5. Compare Merkle roots
    const rootsMatch = calculatedRoot.toLowerCase() === blockchainRoot.toLowerCase();
    const isFullyValid = rootsMatch && hashChainValid && records.length === batch.record_count;

    const verificationStatus: 'VALID' | 'TAMPERED' = isFullyValid ? 'VALID' : 'TAMPERED';
    const verifiedAt = new Date().toISOString();

    const message = isFullyValid
      ? `✓ Batch integrity verified. All ${records.length} sensor records cryptographically match Hyperledger Fabric Merkle Root.`
      : `⚠ DATA INTEGRITY FAILURE: Sensor data in MySQL does not match the immutable Hyperledger Fabric ledger root. Possible data modification or deletion detected.`;

    // 6. Log verification result in database
    await BlockchainRepository.logVerification(
      {
        batch_id: batchId,
        delivery_id: batch.delivery_id,
        status: verificationStatus,
        calculated_merkle_root: calculatedRoot,
        blockchain_merkle_root: blockchainRoot,
        hash_chain_valid: hashChainValid,
        tampered_record_count: tamperedRecords.length,
        details_json: {
          recordsVerified: records.length,
          rootsMatch,
          tamperedRecords
        }
      },
      env
    );

    // Update batch status
    await BlockchainRepository.updateBatchStatus(batchId, isFullyValid ? 'VERIFIED' : 'TAMPERED', verifiedAt, env);

    return {
      verified: isFullyValid,
      status: verificationStatus,
      message,
      batchId,
      deliveryId: batch.delivery_id,
      calculatedRoot,
      blockchainRoot,
      blockchainTxId: batch.blockchain_tx_id,
      blockNumber: batch.block_number,
      recordCount: records.length,
      hashChainValid,
      tamperedRecords,
      verifiedAt,
      treeStructure: rebuiltTree.getStructure()
    };
  }

  /**
   * Verifies all batches associated with a delivery.
   */
  static async verifyAllBatchesForDelivery(deliveryId: number, env?: EnvBindings) {
    const batches = await BlockchainRepository.getAllBatchesForDelivery(deliveryId, env);
    const results = [];
    let allValid = true;

    for (const batch of batches) {
      const res = await this.verifyBatch(batch.batch_id, env);
      if (!res.verified) {
        allValid = false;
      }
      results.push(res);
    }

    return {
      deliveryId,
      totalBatches: batches.length,
      allValid,
      overallStatus: allValid ? 'VALID' : 'TAMPERED',
      batchResults: results,
      verifiedAt: new Date().toISOString()
    };
  }

  // In-memory backup map for simulating and restoring tampering
  private static tamperBackups: Map<number, SensorLog> = new Map();

  /**
   * Tamper Simulation Tool: Injects a deliberate modification in MySQL sensor records
   * without updating the blockchain proof, demonstrating real-time tamper detection in the UI.
   */
  static async simulateDatabaseTamper(
    deliveryId: number,
    logId?: number,
    field: string = 'temperature',
    newValue: number = 28.5,
    env?: EnvBindings
  ): Promise<{ success: boolean; modifiedLogId: number; originalValue: any; tamperedValue: any; message: string }> {
    let targetLog: SensorLog | null = null;

    if (logId) {
      const logs = await SensorRepository.getLogsByDelivery(deliveryId, 100, env);
      targetLog = logs.find((l: SensorLog) => l.id === logId) || null;
    } else {
      targetLog = await SensorRepository.getLatestLogByDelivery(deliveryId, env);
      if (!targetLog) {
        const logs = await SensorRepository.getLogsByDelivery(deliveryId, 1, env);
        if (logs.length > 0) targetLog = logs[0];
      }
    }

    if (!targetLog) {
      throw new Error(`No sensor logs found for delivery #${deliveryId} to tamper.`);
    }

    // Save exact backup before modification
    this.tamperBackups.set(targetLog.id, { ...targetLog });

    const originalValue = (targetLog as any)[field];
    const updateData: any = {};
    updateData[field] = newValue;

    await SensorRepository.updateSensorLog(targetLog.id, updateData, env);

    await SecurityService.logEvent(
      {
        userId: 1,
        email: 'system@audit.test',
        eventType: 'SIMULATED_DB_TAMPER_INJECTED',
        success: true,
        details: {
          deliveryId,
          logId: targetLog.id,
          field,
          originalValue,
          tamperedValue: newValue
        }
      },
      env
    );

    return {
      success: true,
      modifiedLogId: targetLog.id,
      originalValue,
      tamperedValue: newValue,
      message: `Simulated attack: Modified sensor log #${targetLog.id} ${field} from ${originalValue} to ${newValue} in MySQL. Blockchain ledger remains unaltered.`
    };
  }

  /**
   * Restores simulated tampered records to normal valid values.
   */
  static async restoreTamperedData(
    deliveryId: number,
    env?: EnvBindings
  ): Promise<{ success: boolean; message: string }> {
    for (const [logId, backup] of this.tamperBackups.entries()) {
      await SensorRepository.updateSensorLog(
        logId,
        {
          temperature: backup.temperature,
          humidity: backup.humidity,
          methane: backup.methane,
          co2: backup.co2,
          record_hash: backup.record_hash || undefined
        },
        env
      );
    }
    this.tamperBackups.clear();

    return {
      success: true,
      message: `Database integrity restored for delivery #${deliveryId}.`
    };
  }
}
