export type UserRole = 'admin' | 'sender' | 'driver';

export interface User {
  id: number;
  email: string;
  full_name: string | null;
  phone_number: string | null;
  role: UserRole;
  is_active: number;
  first_login: number;
  created_at: string;
  updated_at: string;
  sensor_module_id?: number | null;
  device_id?: string;
  device_name?: string;
}

export type DeliveryStatus =
  | 'pending'
  | 'assigned'
  | 'accepted'
  | 'in_transit'
  | 'completed'
  | 'cancelled';

export interface Delivery {
  id: number;
  delivery_code: string;
  sender_id: number;
  driver_id: number | null;
  sensor_module_id: number | null;
  food_name: string;
  source_location: string;
  destination_location: string;
  start_time: string;
  status: DeliveryStatus;
  created_at: string;
  updated_at: string;
  assigned_at: string | null;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  route_risk_data?: string | null;
  // Joined fields
  sender_name?: string;
  sender_email?: string;
  driver_name?: string;
  driver_email?: string;
  driver_phone?: string;
  device_id?: string;
  device_name?: string;
}

export type SensorStatus = 'available' | 'assigned' | 'offline' | 'removed';

export interface SensorModule {
  id: number;
  device_id: string;
  device_name: string;
  hardware_model: string;
  firmware_version: string;
  driver_id?: number | null;
  status: SensorStatus;
  is_active: number;
  is_live?: boolean;
  last_seen_at: string | null;
  registered_by: number | null;
  created_at: string;
  updated_at: string;
  registered_by_name?: string;
  driver_name?: string;
  driver_email?: string;
  driver_phone?: string;
  current_delivery_id?: number | null;
  current_delivery_code?: string | null;
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN';

export interface SensorLog {
  id: number;
  delivery_id: number;
  sensor_module_id: number;
  temperature: number;
  humidity: number;
  methane: number;
  co2: number;
  storage_hours?: number;
  storage_days: number;
  score: number;
  status: string;
  risk_level: RiskLevel;
  spoil_in?: number | null;
  device_recorded_at?: string | null;
  recorded_at: string;
}

export interface ModelPrediction {
  id: number;
  delivery_id: number;
  sensor_log_id: number;
  model_version: string;
  score: number;
  risk_level: RiskLevel;
  spoil_in?: number | null;
  prediction_timestamp: string;
}

export interface Notification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  data_json: any;
  is_read: number;
  created_at: string;
}

export interface SecurityLog {
  id: number;
  user_id: number | null;
  email: string | null;
  event_type: string;
  ip_address: string | null;
  user_agent: string | null;
  success: number;
  details_json: any;
  created_at: string;
}

export interface DriverLocation {
  id: number;
  driver_id: number;
  delivery_id: number;
  latitude: number;
  longitude: number;
  recorded_at: string;
}

export interface DashboardStats {
  totalUsers?: number;
  activeDrivers?: number;
  pendingDeliveries: number;
  currentDeliveries: number;
  completedDeliveries: number;
  assignedDeliveries?: number;
  totalSensors?: number;
  availableSensors?: number;
  highRiskDeliveries?: number;
}

export type BlockchainBatchStatus = 'PENDING' | 'ANCHORED' | 'VERIFIED' | 'TAMPERED' | 'FAILED';
export type BatchType = 'PERIODIC_HOURLY' | 'BATCH_SIZE_THRESHOLD' | 'CRITICAL_EVENT' | 'MANUAL_TRIGGER';

export interface BlockchainBatch {
  id: number;
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
  blockchain_status: BlockchainBatchStatus;
  batch_type: BatchType;
  tamper_event_type?: string | null;
  metadata_json?: any;
  verified_at?: string | null;
  created_at: string;
  delivery_code?: string;
  food_name?: string;
  driver_name?: string;
  onChainProof?: any;
  verifications?: BlockchainVerification[];
}

export interface BlockchainVerification {
  id: number;
  batch_id: string;
  delivery_id: number;
  status: 'VALID' | 'TAMPERED' | 'ERROR';
  calculated_merkle_root: string;
  blockchain_merkle_root: string;
  hash_chain_valid: number;
  tampered_record_count: number;
  details_json?: any;
  verified_by: string;
  verified_at: string;
}

export interface MerkleTreeStructure {
  root: string;
  leaves: string[];
  depth: number;
  levels: string[][];
  totalNodes: number;
}

export interface LedgerStatus {
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
}

export interface BatchVerificationResult {
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
  treeStructure?: MerkleTreeStructure;
}
