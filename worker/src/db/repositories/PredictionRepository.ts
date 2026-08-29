import { executeQuery } from '../connection';
import { ModelPrediction, RiskLevel, EnvBindings } from '../../types';
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export class PredictionRepository {
  static async create(
    data: {
      delivery_id: number;
      sensor_log_id: number;
      model_version: string;
      score: number;
      risk_level: RiskLevel;
      spoil_in?: number | null;
    },
    env?: EnvBindings
  ): Promise<number> {
    const result = await executeQuery<ResultSetHeader>(
      `INSERT INTO model_predictions (delivery_id, sensor_log_id, model_version, score, risk_level, spoil_in, prediction_timestamp)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        data.delivery_id,
        data.sensor_log_id,
        data.model_version,
        data.score,
        data.risk_level,
        data.spoil_in !== undefined ? data.spoil_in : null
      ],
      env
    );
    return result.insertId;
  }

  static async getByDeliveryId(
    deliveryId: number,
    limit: number = 100,
    env?: EnvBindings
  ): Promise<ModelPrediction[]> {
    const rows = await executeQuery<RowDataPacket[]>(
      `SELECT * FROM model_predictions WHERE delivery_id = ? ORDER BY prediction_timestamp ASC LIMIT ?`,
      [deliveryId, limit],
      env
    );
    return rows as ModelPrediction[];
  }

  static async getLatestByDeliveryId(
    deliveryId: number,
    env?: EnvBindings
  ): Promise<ModelPrediction | null> {
    const rows = await executeQuery<RowDataPacket[]>(
      `SELECT * FROM model_predictions WHERE delivery_id = ? ORDER BY prediction_timestamp DESC, id DESC LIMIT 1`,
      [deliveryId],
      env
    );
    return (rows[0] as ModelPrediction) || null;
  }
}
