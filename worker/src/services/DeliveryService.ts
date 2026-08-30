import { DeliveryRepository } from '../db/repositories/DeliveryRepository';
import { RouteService } from './RouteService';
import { SecurityService } from './SecurityService';
import { NotificationService } from './NotificationService';
import { generateDeliveryCode } from '../utils/crypto';
import { Delivery, DeliveryStatus, UserRole, EnvBindings } from '../types';
import { executeQuery } from '../db/connection';
import { RowDataPacket } from 'mysql2/promise';

export class DeliveryService {
  static async createDelivery(
    data: {
      food_name: string;
      source_location: string;
      destination_location: string;
      start_time?: string;
      driver_id?: number;
    },
    sender: { id: number; email: string; full_name?: string | null; role?: UserRole },
    env?: EnvBindings
  ): Promise<Delivery> {
    const code = generateDeliveryCode();

    // Compute and freeze Route Risk & Weather Forecast once at delivery creation
    let routeRiskJson: string | null = null;
    try {
      const depDate = data.start_time
        ? new Date(data.start_time).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      const routeAnalysis = await RouteService.getRouteAnalysis(
        data.source_location,
        data.destination_location,
        depDate,
        '09:30',
        env
      );
      if (routeAnalysis) {
        routeRiskJson = JSON.stringify(routeAnalysis);
      }
    } catch (routeErr) {
      console.warn('[DeliveryService] Initial route analysis warning:', routeErr);
    }

    const insertId = await DeliveryRepository.create(
      {
        delivery_code: code,
        sender_id: sender.id,
        food_name: data.food_name.trim(),
        source_location: data.source_location.trim(),
        destination_location: data.destination_location.trim(),
        start_time: data.start_time,
        driver_id: data.driver_id || null,
        route_risk_data: routeRiskJson
      },
      env
    );

    // Audit log
    await SecurityService.logEvent(
      {
        userId: sender.id,
        email: sender.email,
        eventType: 'DELIVERY_CREATED',
        success: true,
        details: { deliveryId: insertId, deliveryCode: code, foodName: data.food_name, driverId: data.driver_id || null }
      },
      env
    );

    // If driver was selected on create, notify Driver
    if (data.driver_id) {
      await NotificationService.sendNotification(
        {
          userId: data.driver_id,
          type: 'DELIVERY_ASSIGNED',
          title: 'New Delivery Assignment',
          message: `Sender ${sender.full_name || sender.email} assigned delivery #${code} ("${data.food_name}") to you. Please review and accept.`,
          data: { deliveryId: insertId, deliveryCode: code }
        },
        env
      );
    }

    // Notify Admins about new delivery request
    const adminRows = await executeQuery<RowDataPacket[]>(
      "SELECT id FROM users WHERE role = 'admin' AND is_active = 1 AND deleted_at IS NULL",
      [],
      env
    );
    const adminIds = adminRows.map((r) => r.id);
    await NotificationService.sendBulkNotification(
      adminIds,
      {
        type: 'NEW_DELIVERY',
        title: 'New Delivery Requested',
        message: `Sender ${sender.full_name || sender.email} submitted delivery #${code} for "${data.food_name}".`,
        data: { deliveryId: insertId, deliveryCode: code }
      },
      env
    );

    const created = await DeliveryRepository.findById(insertId, env);
    return created!;
  }

  static async assignDriver(
    deliveryId: number,
    driverId: number,
    sensorModuleId: number | undefined,
    user: { id: number; email: string; role: UserRole; full_name?: string | null },
    env?: EnvBindings
  ): Promise<Delivery> {
    const existing = await DeliveryRepository.findById(deliveryId, env);
    if (!existing) throw new Error('Delivery not found');

    if (user.role === 'sender' && existing.sender_id !== user.id) {
      throw new Error('You can only assign drivers to your own deliveries');
    }

    await DeliveryRepository.assignDriver(deliveryId, driverId, sensorModuleId, env);

    const delivery = await DeliveryRepository.findById(deliveryId, env);
    if (!delivery) throw new Error('Delivery not found');

    // Audit log
    await SecurityService.logEvent(
      {
        userId: user.id,
        email: user.email,
        eventType: 'DELIVERY_ASSIGNED',
        success: true,
        details: {
          deliveryId,
          deliveryCode: delivery.delivery_code,
          driverId,
          assignedBy: user.role
        }
      },
      env
    );

    // Notify Driver
    await NotificationService.sendNotification(
      {
        userId: driverId,
        type: 'DELIVERY_ASSIGNED',
        title: 'New Delivery Assignment',
        message: `You have been assigned delivery #${delivery.delivery_code} (${delivery.food_name}). Please review and accept.`,
        data: { deliveryId, deliveryCode: delivery.delivery_code }
      },
      env
    );

    // Notify Sender if assigned by admin
    if (user.role === 'admin') {
      await NotificationService.sendNotification(
        {
          userId: delivery.sender_id,
          type: 'DELIVERY_ASSIGNED',
          title: 'Delivery Assigned',
          message: `Your delivery #${delivery.delivery_code} has been assigned to driver ${delivery.driver_name || 'Assigned Driver'}.`,
          data: { deliveryId, deliveryCode: delivery.delivery_code }
        },
        env
      );
    }

    return delivery;
  }

  static async rejectDelivery(
    deliveryId: number,
    driver: { id: number; email: string; full_name?: string | null },
    reason?: string,
    env?: EnvBindings
  ): Promise<Delivery> {
    const delivery = await DeliveryRepository.findById(deliveryId, env);
    if (!delivery) throw new Error('Delivery not found');

    if (delivery.driver_id !== driver.id) {
      throw new Error('You are not authorized to reject this delivery');
    }

    if (delivery.status !== 'assigned') {
      throw new Error(`Cannot reject delivery with status: ${delivery.status}. Only newly assigned orders can be rejected.`);
    }

    await DeliveryRepository.rejectDelivery(deliveryId, env);

    // Audit log
    await SecurityService.logEvent(
      {
        userId: driver.id,
        email: driver.email,
        eventType: 'DELIVERY_REJECTED',
        success: true,
        details: { deliveryId, deliveryCode: delivery.delivery_code, reason: reason || 'Driver declined assignment' }
      },
      env
    );

    // Notify Sender
    await NotificationService.sendNotification(
      {
        userId: delivery.sender_id,
        type: 'DELIVERY_REJECTED',
        title: 'Driver Declined Delivery Assignment',
        message: `Driver ${driver.full_name || driver.email} declined delivery #${delivery.delivery_code}. Your shipment is now pending reassignment.`,
        data: { deliveryId, deliveryCode: delivery.delivery_code }
      },
      env
    );

    // Notify Admins
    const adminRows = await executeQuery<RowDataPacket[]>(
      "SELECT id FROM users WHERE role = 'admin' AND is_active = 1 AND deleted_at IS NULL",
      [],
      env
    );
    const adminIds = adminRows.map((r) => r.id);
    await NotificationService.sendBulkNotification(
      adminIds,
      {
        type: 'DELIVERY_REJECTED',
        title: 'Driver Declined Delivery Assignment',
        message: `Driver ${driver.full_name || driver.email} declined delivery #${delivery.delivery_code}.`,
        data: { deliveryId, deliveryCode: delivery.delivery_code }
      },
      env
    );

    const updated = await DeliveryRepository.findById(deliveryId, env);
    return updated!;
  }

  static async acceptDelivery(
    deliveryId: number,
    driver: { id: number; email: string; full_name?: string | null },
    env?: EnvBindings
  ): Promise<Delivery> {
    const delivery = await DeliveryRepository.findById(deliveryId, env);
    if (!delivery) throw new Error('Delivery not found');

    if (delivery.driver_id !== driver.id) {
      throw new Error('You are not authorized to accept this delivery');
    }

    if (delivery.status !== 'assigned') {
      throw new Error(`Cannot accept delivery with status: ${delivery.status}`);
    }

    await DeliveryRepository.updateStatus(deliveryId, 'accepted', 'accepted_at', env);

    // Audit log
    await SecurityService.logEvent(
      {
        userId: driver.id,
        email: driver.email,
        eventType: 'DELIVERY_ACCEPTED',
        success: true,
        details: { deliveryId, deliveryCode: delivery.delivery_code }
      },
      env
    );

    // Notify Sender
    await NotificationService.sendNotification(
      {
        userId: delivery.sender_id,
        type: 'DELIVERY_ACCEPTED',
        title: 'Driver Accepted Delivery',
        message: `Driver ${driver.full_name || driver.email} accepted delivery #${delivery.delivery_code}.`,
        data: { deliveryId, deliveryCode: delivery.delivery_code }
      },
      env
    );

    const updated = await DeliveryRepository.findById(deliveryId, env);
    return updated!;
  }

  static async startDelivery(
    deliveryId: number,
    driver: { id: number; email: string; full_name?: string | null },
    env?: EnvBindings
  ): Promise<Delivery> {
    const delivery = await DeliveryRepository.findById(deliveryId, env);
    if (!delivery) throw new Error('Delivery not found');

    if (delivery.driver_id !== driver.id) {
      throw new Error('You are not authorized to start this delivery');
    }

    if (delivery.status !== 'accepted') {
      throw new Error(`Cannot start delivery with status: ${delivery.status}. It must be accepted first.`);
    }

    await DeliveryRepository.updateStatus(deliveryId, 'in_transit', 'started_at', env);

    // Audit log
    await SecurityService.logEvent(
      {
        userId: driver.id,
        email: driver.email,
        eventType: 'DELIVERY_STARTED',
        success: true,
        details: { deliveryId, deliveryCode: delivery.delivery_code }
      },
      env
    );

    // Notify Sender
    await NotificationService.sendNotification(
      {
        userId: delivery.sender_id,
        type: 'DELIVERY_IN_TRANSIT',
        title: 'Delivery in Transit',
        message: `Delivery #${delivery.delivery_code} is now on the way! Live IoT monitoring is active.`,
        data: { deliveryId, deliveryCode: delivery.delivery_code }
      },
      env
    );

    const updated = await DeliveryRepository.findById(deliveryId, env);
    return updated!;
  }

  static async completeDelivery(
    deliveryId: number,
    driver: { id: number; email: string; full_name?: string | null },
    env?: EnvBindings
  ): Promise<Delivery> {
    const delivery = await DeliveryRepository.findById(deliveryId, env);
    if (!delivery) throw new Error('Delivery not found');

    if (delivery.driver_id !== driver.id) {
      throw new Error('You are not authorized to complete this delivery');
    }

    if (delivery.status !== 'in_transit') {
      throw new Error(`Cannot complete delivery with status: ${delivery.status}. It must be in_transit first.`);
    }

    await DeliveryRepository.updateStatus(deliveryId, 'completed', 'completed_at', env);

    // Audit log
    await SecurityService.logEvent(
      {
        userId: driver.id,
        email: driver.email,
        eventType: 'DELIVERY_COMPLETED',
        success: true,
        details: { deliveryId, deliveryCode: delivery.delivery_code }
      },
      env
    );

    // Notify Sender
    await NotificationService.sendNotification(
      {
        userId: delivery.sender_id,
        type: 'DELIVERY_COMPLETED',
        title: 'Delivery Successfully Completed',
        message: `Delivery #${delivery.delivery_code} (${delivery.food_name}) has been delivered!`,
        data: { deliveryId, deliveryCode: delivery.delivery_code }
      },
      env
    );

    const updated = await DeliveryRepository.findById(deliveryId, env);
    return updated!;
  }

  static async listDeliveries(
    params: {
      userId?: number;
      role?: UserRole;
      status?: DeliveryStatus;
      statusGroup?: 'pending' | 'current' | 'completed';
      search?: string;
      page?: number;
      limit?: number;
    },
    env?: EnvBindings
  ) {
    return DeliveryRepository.listDeliveries(params, env);
  }

  static async getDeliveryById(id: number, user: { id: number; role: UserRole }, env?: EnvBindings) {
    const delivery = await DeliveryRepository.findById(id, env);
    if (!delivery) return null;

    // Check authorization: Admin can view all, Sender only own, Driver only assigned
    if (user.role === 'sender' && delivery.sender_id !== user.id) {
      throw new Error('Unauthorized to view this delivery');
    }
    if (user.role === 'driver' && delivery.driver_id !== user.id) {
      throw new Error('Unauthorized to view this delivery');
    }

    return delivery;
  }
}
