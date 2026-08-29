export type UserRole = 'admin' | 'sender' | 'driver';

export interface User {
  id: number;
  email: string;
  password_hash?: string;
  full_name: string | null;
  phone_number: string | null;
  role: UserRole;
  is_active: number;
  first_login: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
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
  api_key_hash?: string;
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
  // Joined fields
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

export interface SystemSetting {
  id: number;
  setting_key: string;
  setting_value: string;
  description: string | null;
  updated_at: string;
}

export interface AuthTokenPayload {
  userId: number;
  email: string;
  role: UserRole;
  firstLogin: boolean;
  exp: number;
}

export interface EnvBindings {
  ENVIRONMENT?: string;
  DB_HOST?: string;
  DB_PORT?: string;
  DB_NAME?: string;
  DB_USER?: string;
  DB_PASSWORD?: string;
  JWT_SECRET?: string;
  CORS_ORIGIN?: string;
  [key: string]: any;
}

export interface AppEnv {
  Bindings: EnvBindings;
  Variables: {
    user: User;
    tokenPayload: AuthTokenPayload;
  };
}
