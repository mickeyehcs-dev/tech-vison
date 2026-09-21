import { sha256 } from '../../utils/crypto';
import { MerkleProof, MerkleProofNode, MerkleTreeStructure } from '../../types';

export interface CanonicalSensorData {
  delivery_id: number;
  sensor_module_id: number;
  sequence_number: number;
  temperature: number;
  humidity: number;
  methane: number;
  co2: number;
  storage_hours?: number;
  storage_days?: number;
  score?: number;
  status?: string;
  device_recorded_at?: string | null;
}

export const GENESIS_PREVIOUS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

import { normalizeCanonicalTimestamp } from '../../utils/datetime';

/**
 * Deterministically serializes sensor record attributes to a standard canonical string.
 */
export function canonicalizeSensorRecord(record: CanonicalSensorData): string {
  const normalized = {
    delivery_id: Number(record.delivery_id),
    sensor_module_id: Number(record.sensor_module_id),
    sequence_number: Number(record.sequence_number || 1),
    temperature: Number(Number(record.temperature).toFixed(2)),
    humidity: Number(Number(record.humidity).toFixed(2)),
    methane: Number(Number(record.methane || 0).toFixed(4)),
    co2: Number(Number(record.co2 || 0).toFixed(2)),
    storage_hours: Number(Number(record.storage_hours || 0).toFixed(2)),
    storage_days: Number(Number(record.storage_days || 0).toFixed(2)),
    score: Number(Number(record.score || 0).toFixed(2)),
    status: String(record.status || 'SAFE').trim().toUpperCase(),
    device_recorded_at: normalizeCanonicalTimestamp(record.device_recorded_at)
  };

  // Sort keys alphabetically for strictly deterministic JSON serialization
  const sortedKeys = Object.keys(normalized).sort() as (keyof typeof normalized)[];
  const sortedObj: Record<string, any> = {};
  for (const k of sortedKeys) {
    sortedObj[k] = normalized[k];
  }

  return JSON.stringify(sortedObj);
}

/**
 * Computes deterministic SHA-256 hash for a sensor record in the sequential hash chain:
 * H_n = SHA256(canonicalPayload + previousHash)
 */
export async function computeSensorRecordHash(
  record: CanonicalSensorData,
  previousHash: string = GENESIS_PREVIOUS_HASH
): Promise<string> {
  const canonicalString = canonicalizeSensorRecord(record);
  const payloadToHash = `${canonicalString}|PREV:${previousHash || GENESIS_PREVIOUS_HASH}`;
  return sha256(payloadToHash);
}

/**
 * Pairwise hash for two Merkle nodes:
 * H_parent = SHA256(leftHash + rightHash)
 */
export async function hashPair(left: string, right: string): Promise<string> {
  return sha256(left + right);
}

/**
 * Cryptographic Merkle Tree implementation for batch cold-chain data proofs.
 */
export class MerkleTree {
  private leaves: string[];
  private levels: string[][];
  private root: string;

  private constructor(leaves: string[], levels: string[][], root: string) {
    this.leaves = leaves;
    this.levels = levels;
    this.root = root;
  }

  /**
   * Asynchronously builds a Merkle Tree from an array of SHA-256 leaf hashes.
   */
  static async create(leafHashes: string[]): Promise<MerkleTree> {
    if (!leafHashes || leafHashes.length === 0) {
      const emptyRoot = await sha256('EMPTY_MERKLE_TREE_ROOT');
      return new MerkleTree([], [[emptyRoot]], emptyRoot);
    }

    const leaves = [...leafHashes];
    const levels: string[][] = [leaves];

    let currentLevel = leaves;

    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];

      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        // If odd number of nodes in level, pair with itself (standard Merkle tree duplication)
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
        const parentHash = await hashPair(left, right);
        nextLevel.push(parentHash);
      }

      levels.push(nextLevel);
      currentLevel = nextLevel;
    }

    const root = currentLevel[0];
    return new MerkleTree(leaves, levels, root);
  }

  getRoot(): string {
    return this.root;
  }

  getLeaves(): string[] {
    return [...this.leaves];
  }

  getLevels(): string[][] {
    return this.levels.map((level) => [...level]);
  }

  getDepth(): number {
    return this.levels.length;
  }

  /**
   * Generates a cryptographic inclusion proof for a leaf at a given index.
   */
  getProof(leafIndex: number): MerkleProofNode[] {
    if (leafIndex < 0 || leafIndex >= this.leaves.length) {
      throw new Error(`Invalid leaf index ${leafIndex} for tree with ${this.leaves.length} leaves`);
    }

    const proof: MerkleProofNode[] = [];
    let currentIndex = leafIndex;

    for (let level = 0; level < this.levels.length - 1; level++) {
      const currentLevelNodes = this.levels[level];
      const isRightNode = currentIndex % 2 === 1;
      const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;

      if (siblingIndex < currentLevelNodes.length) {
        proof.push({
          position: isRightNode ? 'left' : 'right',
          hash: currentLevelNodes[siblingIndex]
        });
      } else {
        // Paired with self
        proof.push({
          position: 'right',
          hash: currentLevelNodes[currentIndex]
        });
      }

      currentIndex = Math.floor(currentIndex / 2);
    }

    return proof;
  }

  /**
   * Verifies that a leaf hash is part of a Merkle root given its inclusion proof.
   */
  static async verifyProof(leaf: string, proof: MerkleProofNode[], expectedRoot: string): Promise<boolean> {
    let currentHash = leaf;

    for (const node of proof) {
      if (node.position === 'left') {
        currentHash = await hashPair(node.hash, currentHash);
      } else {
        currentHash = await hashPair(currentHash, node.hash);
      }
    }

    return currentHash.toLowerCase() === expectedRoot.toLowerCase();
  }

  /**
   * Returns a complete JSON representation of the tree structure for UI visualization.
   */
  getStructure(): MerkleTreeStructure {
    let totalNodes = 0;
    for (const lvl of this.levels) {
      totalNodes += lvl.length;
    }

    return {
      root: this.root,
      leaves: [...this.leaves],
      depth: this.levels.length,
      levels: this.getLevels(),
      totalNodes
    };
  }
}
