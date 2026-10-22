import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { RolesGuard } from '../src/auth/roles.guard.js';

function context(roles: string[]): ExecutionContext {
  return {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user: { id: 'u1', username: 'user', employeeId: null, roles } }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('từ chối khi vai trò không phù hợp', () => {
    const reflector = { getAllAndOverride: () => ['ADMIN'] } as unknown as Reflector;
    expect(new RolesGuard(reflector).canActivate(context(['EMPLOYEE']))).toBe(false);
  });

  it('cho phép vai trò được yêu cầu', () => {
    const reflector = { getAllAndOverride: () => ['HR', 'ADMIN'] } as unknown as Reflector;
    expect(new RolesGuard(reflector).canActivate(context(['HR']))).toBe(true);
  });
});
