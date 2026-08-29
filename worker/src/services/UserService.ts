import { UserRepository } from '../db/repositories/UserRepository';
import { SecurityService } from './SecurityService';
import { hashPassword, generateSecureToken } from '../utils/crypto';
import { User, UserRole, EnvBindings } from '../types';

export class UserService {
  static async createUser(
    data: {
      email: string;
      role: UserRole;
      fullName?: string;
      phoneNumber?: string;
      initialPassword?: string;
    },
    adminUser: { id: number; email: string },
    env?: EnvBindings
  ): Promise<{ user: Omit<User, 'password_hash'>; initialPassword: string }> {
    const existing = await UserRepository.findByEmail(data.email, env);
    if (existing) {
      throw new Error('A user with this email address already exists');
    }

    const tempPassword = data.initialPassword || `Smart@${generateSecureToken().substring(0, 8)}`;
    const passwordHash = await hashPassword(tempPassword);

    const insertId = await UserRepository.create(
      {
        email: data.email,
        password_hash: passwordHash,
        full_name: data.fullName || null,
        phone_number: data.phoneNumber || null,
        role: data.role,
        first_login: 1
      },
      env
    );

    await SecurityService.logEvent(
      {
        userId: adminUser.id,
        email: adminUser.email,
        eventType: 'USER_CREATED',
        success: true,
        details: { newUserId: insertId, newUserEmail: data.email, role: data.role }
      },
      env
    );

    const newUser = await UserRepository.findById(insertId, env);
    const { password_hash, ...safeUser } = newUser!;

    return {
      user: safeUser,
      initialPassword: tempPassword
    };
  }

  static async updateUser(
    id: number,
    data: { fullName?: string; phoneNumber?: string },
    adminUser: { id: number; email: string },
    env?: EnvBindings
  ): Promise<Omit<User, 'password_hash'>> {
    const user = await UserRepository.findById(id, env);
    if (!user) {
      throw new Error('User not found');
    }

    await UserRepository.update(id, {
      full_name: data.fullName,
      phone_number: data.phoneNumber
    }, env);

    await SecurityService.logEvent(
      {
        userId: adminUser.id,
        email: adminUser.email,
        eventType: 'USER_UPDATED',
        success: true,
        details: { targetUserId: id, updates: data }
      },
      env
    );

    const updated = await UserRepository.findById(id, env);
    const { password_hash, ...safeUser } = updated!;
    return safeUser;
  }

  static async setUserStatus(
    id: number,
    isActive: boolean,
    adminUser: { id: number; email: string },
    env?: EnvBindings
  ): Promise<boolean> {
    const user = await UserRepository.findById(id, env);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.id === adminUser.id && !isActive) {
      throw new Error('You cannot deactivate your own admin account');
    }

    await UserRepository.setStatus(id, isActive, env);

    await SecurityService.logEvent(
      {
        userId: adminUser.id,
        email: adminUser.email,
        eventType: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        success: true,
        details: { targetUserId: id, targetEmail: user.email }
      },
      env
    );

    return true;
  }

  static async softDeleteUser(
    id: number,
    adminUser: { id: number; email: string },
    env?: EnvBindings
  ): Promise<boolean> {
    const user = await UserRepository.findById(id, env);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.id === adminUser.id) {
      throw new Error('You cannot delete your own admin account');
    }

    await UserRepository.softDelete(id, env);

    await SecurityService.logEvent(
      {
        userId: adminUser.id,
        email: adminUser.email,
        eventType: 'USER_DELETED',
        success: true,
        details: { targetUserId: id, targetEmail: user.email }
      },
      env
    );

    return true;
  }

  static async listUsers(
    params: { role?: UserRole; search?: string; is_active?: number; page?: number; limit?: number },
    env?: EnvBindings
  ) {
    return UserRepository.listUsers(params, env);
  }

  static async getActiveDrivers(env?: EnvBindings) {
    return UserRepository.getActiveDrivers(env);
  }
}
