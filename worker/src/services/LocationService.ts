import { LocationRepository } from '../db/repositories/LocationRepository';
import { DeliveryRepository } from '../db/repositories/DeliveryRepository';
import { DriverLocation, EnvBindings } from '../types';

export class LocationService {
  static async recordDriverLocation(
    driverId: number,
    data: {
      deliveryId: number;
      latitude: number;
      longitude: number;
    },
    env?: EnvBindings
  ): Promise<DriverLocation> {
    // 1. Verify that the delivery belongs to this driver
    const delivery = await DeliveryRepository.findById(data.deliveryId, env);
    if (!delivery) {
      throw new Error('Delivery not found');
    }

    if (delivery.driver_id !== driverId) {
      throw new Error('You are not authorized to update coordinates for this delivery');
    }

    // 2. Validate coordinates
    if (typeof data.latitude !== 'number' || isNaN(data.latitude) || data.latitude < -90 || data.latitude > 90) {
      throw new Error('Invalid latitude coordinate');
    }
    if (typeof data.longitude !== 'number' || isNaN(data.longitude) || data.longitude < -180 || data.longitude > 180) {
      throw new Error('Invalid longitude coordinate');
    }

    const insertId = await LocationRepository.create(
      {
        driver_id: driverId,
        delivery_id: data.deliveryId,
        latitude: data.latitude,
        longitude: data.longitude
      },
      env
    );

    return {
      id: insertId,
      driver_id: driverId,
      delivery_id: data.deliveryId,
      latitude: data.latitude,
      longitude: data.longitude,
      recorded_at: new Date().toISOString()
    };
  }

  static async getLatestLocation(deliveryId: number, env?: EnvBindings): Promise<DriverLocation | null> {
    return LocationRepository.getLatestByDeliveryId(deliveryId, env);
  }

  static async getLocationTrail(deliveryId: number, limit: number = 200, env?: EnvBindings): Promise<DriverLocation[]> {
    return LocationRepository.getHistoryByDeliveryId(deliveryId, limit, env);
  }
}
