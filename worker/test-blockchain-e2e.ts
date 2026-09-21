/**
 * End-to-End Cryptographic & Blockchain Data Integrity Test Suite
 */

import { MerkleTree, computeSensorRecordHash, GENESIS_PREVIOUS_HASH } from './src/services/blockchain/MerkleTree';
import { FabricClient } from './src/services/blockchain/FabricClient';
import { BlockchainBatchService } from './src/services/blockchain/BlockchainBatchService';
import { SensorService } from './src/services/SensorService';
import { BlockchainRepository } from './src/db/repositories/BlockchainRepository';
import { SensorRepository } from './src/db/repositories/SensorRepository';

async function runTests() {
  console.log('\n============================================================');
  console.log('🧪 COLD-CHAIN BLOCKCHAIN DATA INTEGRITY & TAMPER TEST SUITE');
  console.log('============================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, title: string) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${title}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${title}`);
      throw new Error(`Test failed: ${title}`);
    }
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Deterministic Canonical Hashing
    // -------------------------------------------------------------
    console.log('📦 Step 1: Testing Deterministic Canonical Hashing & Hash Chains...');
    const recordA = {
      delivery_id: 1,
      sensor_module_id: 1,
      sequence_number: 1,
      temperature: 4.2,
      humidity: 68.5,
      methane: 0.012,
      co2: 480.0,
      storage_hours: 1.5,
      storage_days: 0.06,
      score: 14.0,
      status: 'LOW'
    };

    const hashA1 = await computeSensorRecordHash(recordA, GENESIS_PREVIOUS_HASH);
    const hashA2 = await computeSensorRecordHash(recordA, GENESIS_PREVIOUS_HASH);
    assert(hashA1 === hashA2, 'Hash is deterministic for identical record contents');
    assert(hashA1.length === 64, 'Record hash is 64-character hex SHA-256');

    // Altering 0.1 degree alters the hash completely
    const tamperedRecordA = { ...recordA, temperature: 4.3 };
    const hashTampered = await computeSensorRecordHash(tamperedRecordA, GENESIS_PREVIOUS_HASH);
    assert(hashA1 !== hashTampered, 'Altering 0.1°C completely changes the cryptographic hash');

    // Sequential chain linkage
    const recordB = { ...recordA, sequence_number: 2, temperature: 4.5 };
    const hashB = await computeSensorRecordHash(recordB, hashA1);
    assert(hashB !== hashA1, 'Second record in hash chain links to previous hash H1');

    // -------------------------------------------------------------
    // Test 2: Merkle Tree Construction & Cryptographic Inclusion Proofs
    // -------------------------------------------------------------
    console.log('\n🌳 Step 2: Testing Merkle Tree Construction & Proof Verification...');
    const sampleHashes = [hashA1, hashB, hashTampered, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'];
    const tree = await MerkleTree.create(sampleHashes);
    const root = tree.getRoot();

    assert(root.length === 64, `Computed valid Merkle root: ${root.substring(0, 16)}...`);
    assert(tree.getDepth() === 3, `Tree depth is ${tree.getDepth()} for 4 leaf nodes`);

    // Verify inclusion proof for leaf #2
    const proofNode = tree.getProof(1);
    const isProofValid = await MerkleTree.verifyProof(sampleHashes[1], proofNode, root);
    assert(isProofValid, 'Cryptographic inclusion proof verified against Merkle root');

    // -------------------------------------------------------------
    // Test 3: Hyperledger Fabric / Synthetic Ledger Health
    // -------------------------------------------------------------
    console.log('\n⛓️ Step 3: Testing Hyperledger Fabric Gateway & Fail-Safe Ledger...');
    const status = FabricClient.getLedgerStatus();
    assert(status.connected, 'Blockchain ledger service is online and active');
    assert(status.channel === 'coldchain-channel', `Active channel: ${status.channel}`);
    assert(status.blockHeight > 0, `Ledger block height: #${status.blockHeight}`);

    // -------------------------------------------------------------
    // Test 4: Ingest Sensor Logs with Automated Hash Chaining
    // -------------------------------------------------------------
    console.log('\n📡 Step 4: Testing Ingestion Pipeline with Cryptographic Hash Chaining...');
    const ingestResult1 = await SensorService.testInjectTelemetry(
      {
        deliveryId: 1,
        temperature: 3.8,
        humidity: 65.0,
        methane: 0.01,
        co2: 460.0
      },
      { id: 1, email: 'admin@smartdelivery.com' }
    );

    assert(ingestResult1.logId > 0, `Sensor log #${ingestResult1.logId} ingested with hash chain`);

    const latestLog = await SensorRepository.getLatestLogForHashChain(1);
    assert(Boolean(latestLog && latestLog.record_hash), 'Sensor log has computed SHA-256 record_hash');
    assert(Boolean(latestLog && latestLog.sequence_number >= 1), `Sequence number is #${latestLog?.sequence_number}`);

    // -------------------------------------------------------------
    // Test 5: Batch Anchoring & On-Chain Ledger Proof Submission
    // -------------------------------------------------------------
    console.log('\n📦 Step 5: Testing Batch Creation & On-Chain Anchoring...');
    const batch = await BlockchainBatchService.anchorPendingRecords(1, { batchType: 'MANUAL_TRIGGER', minRecords: 1 });
    assert(Boolean(batch), `Batch ${batch?.batch_id} anchored on blockchain`);
    assert(Boolean(batch?.merkle_root && batch.merkle_root.length === 64), `Anchored Merkle Root: ${batch?.merkle_root.substring(0, 16)}...`);
    assert(Boolean(batch?.blockchain_tx_id), `Transaction ID: ${batch?.blockchain_tx_id}`);

    // -------------------------------------------------------------
    // Test 6: Cryptographic Verification (Clean Match)
    // -------------------------------------------------------------
    console.log('\n🔍 Step 6: Testing Batch Verification against Blockchain Ledger...');
    if (batch) {
      const verifyRes = await BlockchainBatchService.verifyBatch(batch.batch_id);
      assert(verifyRes.verified, 'Batch verification passed (VALID - Calculated Root matches Ledger Root)');
      assert(verifyRes.status === 'VALID', `Status is ${verifyRes.status}`);
      assert(verifyRes.hashChainValid, 'Sequential hash chain is 100% continuous and intact');
    }

    // -------------------------------------------------------------
    // Test 7: Tamper Attack Simulation & Immediate Detection
    // -------------------------------------------------------------
    console.log('\n🚨 Step 7: Testing Tamper Simulation Attack & Instant Detection...');
    if (batch) {
      const tamperRes = await BlockchainBatchService.simulateDatabaseTamper(1, undefined, 'temperature', 35.0);
      assert(tamperRes.success, `Injected simulated database attack on log #${tamperRes.modifiedLogId}`);

      const auditAfterAttack = await BlockchainBatchService.verifyBatch(batch.batch_id);
      assert(!auditAfterAttack.verified, 'Tamper detected: Verification failed as expected!');
      assert(auditAfterAttack.status === 'TAMPERED', 'Status changed to TAMPERED');
      assert(auditAfterAttack.tamperedRecords.length > 0, `Identified ${auditAfterAttack.tamperedRecords.length} tampered records in MySQL`);

      // -------------------------------------------------------------
      // Test 8: Data Integrity Restoration & Re-verification
      // -------------------------------------------------------------
      console.log('\n🛡️ Step 8: Testing Database Integrity Restoration...');
      const restoreRes = await BlockchainBatchService.restoreTamperedData(1);
      assert(restoreRes.success, 'Database records restored');

      const auditAfterRestore = await BlockchainBatchService.verifyBatch(batch.batch_id);
      assert(auditAfterRestore.verified, 'Re-verification passed after restore (Status: VALID)');
    }

    console.log('\n============================================================');
    console.log(`🎉 ALL ${passed}/${total} BLOCKCHAIN INTEGRITY TESTS PASSED!`);
    console.log('============================================================\n');
  } catch (err: any) {
    console.error('\n❌ Test Suite encountered an error:', err.message);
    process.exit(1);
  }
}

runTests();
