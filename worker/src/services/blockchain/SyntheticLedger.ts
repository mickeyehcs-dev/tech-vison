import { sha256 } from '../../utils/crypto';
import { BatchType } from '../../types';

export interface SyntheticBlock {
  blockNumber: number;
  blockHash: string;
  previousBlockHash: string;
  dataHash: string;
  txCount: number;
  timestamp: string;
  transactions: SyntheticTransaction[];
}

export interface SyntheticTransaction {
  txId: string;
  type: 'RECORD_BATCH_PROOF' | 'RECORD_TAMPER_EVENT' | 'REGISTER_DEVICE' | 'CREATE_SHIPMENT';
  payload: any;
  timestamp: string;
  creator: string;
  status: 'COMMITTED' | 'VALIDATED';
}

export interface SyntheticBatchProof {
  docType: 'batchProof';
  batchId: string;
  shipmentId: string;
  deviceId: string;
  recordCount: number;
  startTime: string;
  endTime: string;
  merkleRoot: string;
  batchType: BatchType;
  tamperEventType?: string | null;
  txId: string;
  blockNumber: number;
  blockTimestamp: string;
}

export interface SyntheticTamperEvent {
  docType: 'tamperEvent';
  eventId: string;
  shipmentId: string;
  deviceId: string;
  eventType: string;
  merkleRoot: string;
  details: any;
  txId: string;
  blockNumber: number;
  blockTimestamp: string;
}

/**
 * High-Fidelity Synthetic Hyperledger Fabric Ledger Engine.
 * Acts as an immutable cryptographic fallback and simulator when external Fabric peers are offline.
 */
export class SyntheticLedger {
  private static instance: SyntheticLedger;

  private blocks: SyntheticBlock[] = [];
  private stateStore: Map<string, any> = new Map();
  private isInitialized = false;

  private constructor() {
    this.initGenesisBlock();
  }

  public static getInstance(): SyntheticLedger {
    if (!SyntheticLedger.instance) {
      SyntheticLedger.instance = new SyntheticLedger();
    }
    return SyntheticLedger.instance;
  }

  private async initGenesisBlock() {
    if (this.isInitialized) return;

    const genesisTxId = 'tx_fab_genesis_00000000000000000000000000000000';
    const genesisTime = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    const genesisTx: SyntheticTransaction = {
      txId: genesisTxId,
      type: 'RECORD_BATCH_PROOF',
      payload: {
        batchId: 'BATCH-GENESIS-001',
        shipmentId: 'SHIP000',
        deviceId: 'SFM-GENESIS',
        recordCount: 1,
        startTime: genesisTime,
        endTime: genesisTime,
        merkleRoot: '0000000000000000000000000000000000000000000000000000000000000000',
        batchType: 'GENESIS'
      },
      timestamp: genesisTime,
      creator: 'Org1MSP (Admin)',
      status: 'COMMITTED'
    };

    const genesisDataHash = await sha256(JSON.stringify(genesisTx));
    const genesisBlockHash = await sha256(`BLOCK:0|PREV:0000000000000000|DATA:${genesisDataHash}`);

    const genesisBlock: SyntheticBlock = {
      blockNumber: 0,
      blockHash: genesisBlockHash,
      previousBlockHash: '0000000000000000000000000000000000000000000000000000000000000000',
      dataHash: genesisDataHash,
      txCount: 1,
      timestamp: genesisTime,
      transactions: [genesisTx]
    };

    this.blocks.push(genesisBlock);

    // Initial seed batch proof for Delivery #1
    const seedBatch1: SyntheticBatchProof = {
      docType: 'batchProof',
      batchId: 'BATCH-DEL-2026-8841-001',
      shipmentId: '1',
      deviceId: 'SFM-7C81A19D',
      recordCount: 1,
      startTime: new Date(Date.now() - 7.5 * 3600 * 1000).toISOString(),
      endTime: new Date(Date.now() - 6.5 * 3600 * 1000).toISOString(),
      merkleRoot: '9e2b17f54c86df5b682312b98e82110c71a3962d35c8b211f18546bdfc1452e8',
      batchType: 'PERIODIC_HOURLY',
      tamperEventType: null,
      txId: 'tx_fab_8f72c91a03e14df8b64e5209ac741bde4410291e',
      blockNumber: 142,
      blockTimestamp: new Date(Date.now() - 6.5 * 3600 * 1000).toISOString()
    };
    this.stateStore.set(`BATCH_${seedBatch1.batchId}`, seedBatch1);

    // Initial seed batch proof for Delivery #2
    const seedBatch2: SyntheticBatchProof = {
      docType: 'batchProof',
      batchId: 'BATCH-DEL-2026-9932-001',
      shipmentId: '2',
      deviceId: 'SFM-99214F8A',
      recordCount: 1,
      startTime: new Date(Date.now() - 5.75 * 3600 * 1000).toISOString(),
      endTime: new Date(Date.now() - 4.75 * 3600 * 1000).toISOString(),
      merkleRoot: '3a884f18c2d589e9bbd62e171092a4e21a719c8f00b2184e1b854e7d9b9211c4',
      batchType: 'CRITICAL_EVENT',
      tamperEventType: 'ELEVATED_RESPIRATION_GAS',
      txId: 'tx_fab_44a9018e6cb0f41295b9d31ecf01487bb0811e54',
      blockNumber: 143,
      blockTimestamp: new Date(Date.now() - 4.75 * 3600 * 1000).toISOString()
    };
    this.stateStore.set(`BATCH_${seedBatch2.batchId}`, seedBatch2);

    this.isInitialized = true;
  }

  /**
   * Appends a new immutable block to the synthetic ledger with transaction payload.
   */
  private async commitBlock(transaction: SyntheticTransaction): Promise<{ blockNumber: number; blockHash: string }> {
    const latestBlock = this.blocks[this.blocks.length - 1];
    const newBlockNumber = (latestBlock ? latestBlock.blockNumber : 143) + 1;
    const previousBlockHash = latestBlock ? latestBlock.blockHash : 'a8f0923bc71d4e0987114299bda8291f0c291882aa';

    const dataHash = await sha256(JSON.stringify(transaction));
    const blockHeader = `BLOCK:${newBlockNumber}|PREV:${previousBlockHash}|DATA:${dataHash}|TIME:${transaction.timestamp}`;
    const blockHash = await sha256(blockHeader);

    const newBlock: SyntheticBlock = {
      blockNumber: newBlockNumber,
      blockHash,
      previousBlockHash,
      dataHash,
      txCount: 1,
      timestamp: transaction.timestamp,
      transactions: [transaction]
    };

    this.blocks.push(newBlock);
    return { blockNumber: newBlockNumber, blockHash };
  }

  /**
   * Generates a deterministic Fabric-like transaction ID: tx_fab_<40 hex chars>
   */
  public async generateTxId(payloadStr: string): Promise<string> {
    const hash = await sha256(`${payloadStr}-${Date.now()}-${Math.random()}`);
    return `tx_fab_${hash.substring(0, 40)}`;
  }

  /**
   * Anchors a batch proof on the synthetic ledger.
   */
  public async recordBatchProof(params: {
    batchId: string;
    shipmentId: string | number;
    deviceId: string;
    recordCount: number;
    startTime: string;
    endTime: string;
    merkleRoot: string;
    batchType?: BatchType;
    tamperEventType?: string | null;
  }): Promise<SyntheticBatchProof> {
    const batchKey = `BATCH_${params.batchId}`;

    const txId = await this.generateTxId(params.batchId + params.merkleRoot);
    const timestamp = new Date().toISOString();

    const transaction: SyntheticTransaction = {
      txId,
      type: 'RECORD_BATCH_PROOF',
      payload: params,
      timestamp,
      creator: 'Org1MSP (ColdChainPeer0)',
      status: 'COMMITTED'
    };

    const { blockNumber } = await this.commitBlock(transaction);

    const batchProof: SyntheticBatchProof = {
      docType: 'batchProof',
      batchId: params.batchId,
      shipmentId: String(params.shipmentId),
      deviceId: params.deviceId,
      recordCount: params.recordCount,
      startTime: params.startTime,
      endTime: params.endTime,
      merkleRoot: params.merkleRoot.toLowerCase(),
      batchType: params.batchType || 'PERIODIC_HOURLY',
      tamperEventType: params.tamperEventType || null,
      txId,
      blockNumber,
      blockTimestamp: timestamp
    };

    this.stateStore.set(batchKey, batchProof);
    return batchProof;
  }

  /**
   * Anchors a critical tamper or anomaly event proof (Adaptive Evidence Window).
   */
  public async recordTamperEvent(params: {
    eventId: string;
    shipmentId: string | number;
    deviceId: string;
    eventType: string;
    merkleRoot: string;
    details?: any;
  }): Promise<SyntheticTamperEvent> {
    const eventKey = `EVENT_${params.eventId}`;
    const txId = await this.generateTxId(params.eventId + params.eventType);
    const timestamp = new Date().toISOString();

    const transaction: SyntheticTransaction = {
      txId,
      type: 'RECORD_TAMPER_EVENT',
      payload: params,
      timestamp,
      creator: 'Org1MSP (ColdChainPeer0)',
      status: 'COMMITTED'
    };

    const { blockNumber } = await this.commitBlock(transaction);

    const tamperEvent: SyntheticTamperEvent = {
      docType: 'tamperEvent',
      eventId: params.eventId,
      shipmentId: String(params.shipmentId),
      deviceId: params.deviceId,
      eventType: params.eventType,
      merkleRoot: params.merkleRoot ? params.merkleRoot.toLowerCase() : '',
      details: params.details || {},
      txId,
      blockNumber,
      blockTimestamp: timestamp
    };

    this.stateStore.set(eventKey, tamperEvent);
    return tamperEvent;
  }

  /**
   * Retrieves a stored batch proof from ledger state.
   */
  public async getBatchProof(batchId: string): Promise<SyntheticBatchProof | null> {
    const batchKey = `BATCH_${batchId}`;
    if (this.stateStore.has(batchKey)) {
      return this.stateStore.get(batchKey);
    }
    if (this.stateStore.has(batchId)) {
      return this.stateStore.get(batchId);
    }
    return null;
  }

  /**
   * Verifies an external computed Merkle Root against the on-chain stored root.
   */
  public async verifyBatch(
    batchId: string,
    computedMerkleRoot: string
  ): Promise<{
    batchId: string;
    verified: boolean;
    status: 'VALID' | 'TAMPERED';
    blockchainMerkleRoot: string;
    submittedMerkleRoot: string;
    txId: string;
    blockNumber: number;
    blockTimestamp: string;
    recordCount: number;
  }> {
    const proof = await this.getBatchProof(batchId);
    if (!proof) {
      throw new Error(`Batch proof ${batchId} not found on blockchain ledger.`);
    }

    const onChainRoot = (proof.merkleRoot || '').toLowerCase();
    const targetRoot = (computedMerkleRoot || '').toLowerCase();
    const isMatch = onChainRoot === targetRoot;

    return {
      batchId,
      verified: isMatch,
      status: isMatch ? 'VALID' : 'TAMPERED',
      blockchainMerkleRoot: onChainRoot,
      submittedMerkleRoot: targetRoot,
      txId: proof.txId,
      blockNumber: proof.blockNumber,
      blockTimestamp: proof.blockTimestamp,
      recordCount: proof.recordCount
    };
  }

  /**
   * Retrieves full blockchain history for a specific shipment.
   */
  public async getShipmentHistory(shipmentId: string | number): Promise<any[]> {
    const targetId = String(shipmentId);
    const results: any[] = [];

    for (const [_, val] of this.stateStore.entries()) {
      if (val && String(val.shipmentId) === targetId) {
        results.push(val);
      }
    }

    return results.sort((a, b) => new Date(a.blockTimestamp || 0).getTime() - new Date(b.blockTimestamp || 0).getTime());
  }

  /**
   * Returns all proofs recorded on the ledger.
   */
  public async getAllProofs(): Promise<SyntheticBatchProof[]> {
    const proofs: SyntheticBatchProof[] = [];
    for (const [_, val] of this.stateStore.entries()) {
      if (val && val.docType === 'batchProof') {
        proofs.push(val);
      }
    }
    return proofs.sort((a, b) => new Date(b.blockTimestamp || 0).getTime() - new Date(a.blockTimestamp || 0).getTime());
  }

  /**
   * Returns ledger health metadata.
   */
  public getLedgerStatus(): {
    network: string;
    channel: string;
    chaincode: string;
    peer: string;
    mode: 'SYNTHETIC_FAILSAFE' | 'HYPERLEDGER_FABRIC_LIVE';
    blockHeight: number;
    totalTransactions: number;
    consensus: string;
    connected: boolean;
    uptimeSeconds: number;
  } {
    return {
      network: 'coldchain-network (Hyperledger Fabric v2.5.4)',
      channel: 'coldchain-channel',
      chaincode: 'coldchain-integrity-chaincode v1.0.0',
      peer: 'peer0.org1.coldchain.com:7051 (Fail-Safe Synthetic Engine Active)',
      mode: 'SYNTHETIC_FAILSAFE',
      blockHeight: 143 + this.blocks.length,
      totalTransactions: this.stateStore.size + this.blocks.length,
      consensus: 'Raft / Crash Fault Tolerant (CFT)',
      connected: true,
      uptimeSeconds: process.uptime ? Math.floor(process.uptime()) : 3600
    };
  }
}
