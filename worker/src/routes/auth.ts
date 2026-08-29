import { Hono } from 'hono';
import { AuthService } from '../services/AuthService';
import { authMiddleware } from '../middleware/authMiddleware';
import { rateLimit } from '../middleware/rateLimitMiddleware';
import { successResponse, errorResponse } from '../utils/response';
import { isValidEmail, isValidPassword } from '../utils/validation';
import { AppEnv } from '../types';

const authRoutes = new Hono<AppEnv>();

// POST /api/v1/auth/login
authRoutes.post('/login', rateLimit(20, 60), async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = body;

    if (!email || !password) {
      return errorResponse(c, 'Email and password are required', 400);
    }

    const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('x-forwarded-for') || '127.0.0.1';
    const userAgent = c.req.header('User-Agent') || 'Unknown';

    const result = await AuthService.login(
      { email, password, ipAddress, userAgent },
      c.env
    );

    // Set secure cookie
    c.header(
      'Set-Cookie',
      `auth_token=${result.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${86400 * 7}${
        c.env?.ENVIRONMENT === 'production' ? '; Secure' : ''
      }`
    );

    return successResponse(c, result);
  } catch (err: any) {
    return errorResponse(c, err.message, 401);
  }
});

// POST /api/v1/auth/logout
authRoutes.post('/logout', async (c) => {
  c.header('Set-Cookie', 'auth_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  return successResponse(c, { message: 'Logged out successfully' });
});

// GET /api/v1/auth/me
authRoutes.get('/me', authMiddleware, async (c) => {
  const user = c.get('user');
  return successResponse(c, { user });
});

// POST /api/v1/auth/onboarding
authRoutes.post('/onboarding', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { fullName, phoneNumber, newPassword, confirmPassword } = body;

    if (!fullName || !phoneNumber || !newPassword) {
      return errorResponse(c, 'All fields are required', 400);
    }

    if (newPassword !== confirmPassword) {
      return errorResponse(c, 'New password and confirmation do not match', 400);
    }

    const pwdCheck = isValidPassword(newPassword);
    if (!pwdCheck.valid) {
      return errorResponse(c, pwdCheck.reason || 'Invalid password', 400);
    }

    const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('x-forwarded-for') || '127.0.0.1';
    const userAgent = c.req.header('User-Agent') || 'Unknown';

    const updatedUser = await AuthService.completeOnboarding(
      user.id,
      { fullName, phoneNumber, newPassword, ipAddress, userAgent },
      c.env
    );

    return successResponse(c, { user: updatedUser, message: 'Onboarding completed successfully' });
  } catch (err: any) {
    return errorResponse(c, err.message, 400);
  }
});

// POST /api/v1/auth/change-password
authRoutes.post('/change-password', authMiddleware, rateLimit(10, 60), async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { currentPassword, newPassword, confirmPassword } = body;

    if (!currentPassword || !newPassword) {
      return errorResponse(c, 'Current and new password are required', 400);
    }

    if (newPassword !== confirmPassword) {
      return errorResponse(c, 'New passwords do not match', 400);
    }

    const pwdCheck = isValidPassword(newPassword);
    if (!pwdCheck.valid) {
      return errorResponse(c, pwdCheck.reason || 'Invalid password', 400);
    }

    const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('x-forwarded-for') || '127.0.0.1';
    const userAgent = c.req.header('User-Agent') || 'Unknown';

    await AuthService.changePassword(
      user.id,
      { currentPassword, newPassword, ipAddress, userAgent },
      c.env
    );

    return successResponse(c, { message: 'Password changed successfully' });
  } catch (err: any) {
    return errorResponse(c, err.message, 400);
  }
});

// PUT /api/v1/auth/profile
authRoutes.put('/profile', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { fullName, phoneNumber } = body;

    const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('x-forwarded-for') || '127.0.0.1';
    const userAgent = c.req.header('User-Agent') || 'Unknown';

    const updatedUser = await AuthService.updateProfile(
      user.id,
      { fullName, phoneNumber, ipAddress, userAgent },
      c.env
    );

    return successResponse(c, { user: updatedUser, message: 'Profile updated successfully' });
  } catch (err: any) {
    return errorResponse(c, err.message, 400);
  }
});

export { authRoutes };
