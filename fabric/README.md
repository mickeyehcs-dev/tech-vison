# ⛓️ Hyperledger Fabric Cold-Chain Data Integrity Architecture

This directory contains the smart contract (chaincode), network topology, and connection assets for the permissioned **Hyperledger Fabric** blockchain ledger.

---

## 🏛️ Smart Contract Specification (`ColdChainIntegrityContract`)

The smart contract deployed to channel `coldchain-channel` exposes the following functions:

| Function | Parameters | Description |
| :--- | :--- | :--- |
| `registerDevice` | `deviceId, deviceName, hardwareModel` | Registers and whitelists authorized edge IoT sensor hardware |
| `createShipment` | `shipmentId, deviceId, foodName, origin, destination` | Initializes cold-chain cargo voyage on the ledger |
| `recordBatchProof` | `batchId, shipmentId, deviceId, recordCount, startTime, endTime, merkleRoot, batchType` | Anchors periodic / threshold Merkle root batch proofs |
| `recordTamperEvent`| `eventId, shipmentId, deviceId, eventType, merkleRoot, detailsJson` | Adaptive emergency evidence window triggered on critical anomalies |
| `getBatchProof` | `batchId` | Retrieves stored on-chain batch metadata and Merkle root |
| `verifyBatch` | `batchId, computedMerkleRoot` | Compares calculated database Merkle root against immutable blockchain ledger |
| `getShipmentHistory` | `shipmentId` | Complete audit trail of all batches and events for a shipment |
| `getAllProofs` | None | Returns all anchored batch proofs across the supply chain |

---

## 🛡️ Dual Execution & Fail-Safe Architecture

The platform operates on a **resilient dual-mode gateway**:

1. **Production Mode (Live Hyperledger Fabric)**:
   - Connects to Hyperledger Fabric peers over gRPC / Fabric Gateway.
   - Endorses transactions across peer nodes and commits blocks to the Orderer.
2. **Fail-Safe Mode (Cryptographic Synthetic Ledger)**:
   - When Docker or Fabric peers are offline or unconfigured during development/demos, the backend activates a high-fidelity **Synthetic Ledger Engine**.
   - Maintains cryptographic block headers, transaction hashes, state Merkle trees, and proof validation rules identically to Fabric with zero crash risk.

---

## 🚀 Running Hyperledger Fabric via Docker

```bash
# 1. Start Fabric CA, Orderer, CouchDB, and Peer containers
docker compose -f fabric/docker/docker-compose-fabric.yaml up -d

# 2. Verify running containers
docker ps
```
