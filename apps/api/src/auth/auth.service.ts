import { createHash, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser, JwtPayload } from './types.js';

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: { roles: { include: { role: true } } },
    });

    const now = new Date();
    if (!user || !user.active || (user.lockedUntil && user.lockedUntil > now)) {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng.');
    }

    if (!(await compare(password, user.passwordHash))) {
      const failedLoginCount = user.failedLoginCount + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount,
          lockedUntil:
            failedLoginCount >= MAX_FAILED_LOGINS
              ? new Date(Date.now() + LOCK_MINUTES * 60_000)
              : null,
        },
      });
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng.');
    }

    const authUser: AuthenticatedUser = {
      id: user.id,
      username: user.username,
      employeeId: user.employeeId,
      roles: user.roles.map((item) => item.role.code),
    };
    const tokens = await this.issueTokens(authUser);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        refreshTokenHash: this.hashToken(tokens.refreshToken),
      },
    });
    return { user: authUser, ...tokens };
  }

  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.refreshSecret(),
      });
    } catch {
      throw new UnauthorizedException();
    }
    if (payload.type !== 'refresh') throw new UnauthorizedException();

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { roles: { include: { role: true } } },
    });
    if (!user?.active || !user.refreshTokenHash) throw new UnauthorizedException();
    const expected = Buffer.from(user.refreshTokenHash, 'hex');
    const actual = Buffer.from(this.hashToken(refreshToken), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new UnauthorizedException();
    }

    const authUser: AuthenticatedUser = {
      id: user.id,
      username: user.username,
      employeeId: user.employeeId,
      roles: user.roles.map((item) => item.role.code),
    };
    const tokens = await this.issueTokens(authUser);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: this.hashToken(tokens.refreshToken) },
    });
    return { user: authUser, ...tokens };
  }

  async logout(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { refreshTokenHash: null } });
    return { success: true };
  }

  private async issueTokens(user: AuthenticatedUser) {
    const base = {
      sub: user.id,
      username: user.username,
      employeeId: user.employeeId,
      roles: user.roles,
    };
    const accessToken = await this.jwt.signAsync(
      { ...base, type: 'access' } satisfies JwtPayload,
      { secret: this.accessSecret(), expiresIn: this.config.get('JWT_ACCESS_TTL') ?? '15m' },
    );
    const refreshToken = await this.jwt.signAsync(
      { ...base, type: 'refresh' } satisfies JwtPayload,
      { secret: this.refreshSecret(), expiresIn: this.config.get('JWT_REFRESH_TTL') ?? '7d' },
    );
    return { accessToken, refreshToken };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private accessSecret() {
    return this.requiredSecret('JWT_ACCESS_SECRET');
  }

  private refreshSecret() {
    return this.requiredSecret('JWT_REFRESH_SECRET');
  }

  private requiredSecret(key: string) {
    const value = this.config.get<string>(key);
    if (!value || value.length < 32) throw new Error(`${key} phải có ít nhất 32 ký tự.`);
    return value;
  }
}
