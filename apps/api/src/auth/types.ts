import type { RoleCode } from '../generated/prisma/index.js';

export interface AuthenticatedUser {
  id: string;
  username: string;
  employeeId: string | null;
  roles: RoleCode[];
}

export interface JwtPayload {
  sub: string;
  username: string;
  employeeId: string | null;
  roles: RoleCode[];
  type: 'access' | 'refresh';
}
