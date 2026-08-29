import { UserRepository } from '../db/repositories/UserRepository';
import { SecurityService } from './SecurityService';
import { hashPassword, verifyPassword } from '../utils/crypto';
import { signJwt } from '../utils/jwt';
import { User, EnvBindings } from '../types';

export class AuthService {
  static async login(
    data: {
      email: string;
      password: string;
      ipAddress?: string;
      userAgent?: string;
    },
    env?: EnvBindings
  ): Promise<{ token: string; user: Omit<User, 'password_hash'> }> {
    const email = data.email.toLowerCase().trim();
    const user = await UserRepository.findByEmail(email, env);

    if (!user) {
      await SecurityService.logEvent(
        {
          email,
          eventType: 'LOGIN_FAILED',
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          success: false,
          details: { reason: 'User not found' }
        },
        env
      );
      throw new Error('Invalid email or password');
    }

    if (!user.is_active) {
      await SecurityService.logEvent(
        {
          userId: user.id,
          email,
          eventType: 'LOGIN_FAILED',
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          success: false,
          details: { reason: 'Account deactivated' }
        },
        env
      );
      throw new Error('Your account is deactivated. Please contact an administrator.');
    }

    const isValid = await verifyPassword(data.password, user.password_hash || '');
    if (!isValid) {
      await SecurityService.logEvent(
        {
          userId: user.id,
          email,
          eventType: 'LOGIN_FAILED',
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          success: false,
          details: { reason: 'Invalid password' }
        },
        env
      );
      throw new Error('Invalid email or password');
    }

    const secret = env?.JWT_SECRET || 'super_secure_jwt_secret_key_smart_food_delivery_2026_x89';
    const token = await signJwt(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        firstLogin: Boolean(user.first_login)
      },
      secret
    );

    await SecurityService.logEvent(
      {
        userId: user.id,
        email: user.email,
        eventType: 'LOGIN_SUCCESS',
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        success: true
      },
      env
    );

    const { password_hash, ...safeUser } = user;
    return {
      token,
      user: safeUser
    };
  }

  static async completeOnboarding(
    userId: number,
    data: {
      fullName: string;
      phoneNumber: string;
      newPassword: string;
      ipAddress?: string;
      userAgent?: string;
    },
    env?: EnvBindings
  ): Promise<Omit<User, 'password_hash'>> {
    const user = await UserRepository.findById(userId, env);
    if (!user) {
      throw new Error('User not found');
    }

    const newHash = await hashPassword(data.newPassword);

    await UserRepository.update(userId, {
      full_name: data.fullName.trim(),
      phone_number: data.phoneNumber.trim()
    }, env);

    await UserRepository.updatePassword(userId, newHash, 0, env);

    await SecurityService.logEvent(
      {
        userId: user.id,
        email: user.email,
        eventType: 'ONBOARDING_COMPLETED',
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        success: true
      },
      env
    );

    const updated = await UserRepository.findById(userId, env);
    const { password_hash, ...safeUser } = updated!;
    return safeUser;
  }

  static async changePassword(
    userId: number,
    data: {
      currentPassword: string;
      newPassword: string;
      ipAddress?: string;
      userAgent?: string;
    },
    env?: EnvBindings
  ): Promise<boolean> {
    const user = await UserRepository.findById(userId, env);
    if (!user) {
      throw new Error('User not found');
    }

    const isCurrentValid = await verifyPassword(data.currentPassword, user.password_hash || '');
    if (!isCurrentValid) {
      await SecurityService.logEvent(
        {
          userId: user.id,
          email: user.email,
          eventType: 'PASSWORD_CHANGE_FAILED',
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          success: false,
          details: { reason: 'Incorrect current password' }
        },
        env
      );
      throw new Error('Current password is incorrect');
    }

    const newHash = await hashPassword(data.newPassword);
    await UserRepository.updatePassword(userId, newHash, 0, env);

    await SecurityService.logEvent(
      {
        userId: user.id,
        email: user.email,
        eventType: 'PASSWORD_CHANGE_SUCCESS',
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        success: true
      },
      env
    );

    return true;
  }

  static async updateProfile(
    userId: number,
    data: {
      fullName?: string;
      phoneNumber?: string;
      ipAddress?: string;
      userAgent?: string;
    },
    env?: EnvBindings
  ): Promise<Omit<User, 'password_hash'>> {
    await UserRepository.update(userId, {
      full_name: data.fullName,
      phone_number: data.phoneNumber
    }, env);

    const updated = await UserRepository.findById(userId, env);
    const { password_hash, ...safeUser } = updated!;
    return safeUser;
  }
}
