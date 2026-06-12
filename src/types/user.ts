export type UserRole = 'admin' | 'user' | 'editor';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  groupIds: string[];
}

export interface Group {
  id: string;
  name: string;
  description: string;
  color: string;
  createdAt: string;
  projectIds: string[];
}

export interface AccessRule {
  id: string;
  pattern: string;
  isActive: boolean;
  createdAt: string;
  notes: string;
}

/** Jedna prośba o dostęp (poczekalnia – czeka na zatwierdzenie przez admina). */
export interface PendingAccessRequest {
  email: string;
  requestedAt: string;
}

export interface AccessControl {
  whitelist: AccessRule[];
  blacklist: AccessRule[];
  /** Osoby, które poprosiły o dostęp – admin musi zatwierdzić, wtedy dostaną kod. */
  pending: PendingAccessRequest[];
}

export interface UsersData {
  users: User[];
}

export interface GroupsData {
  groups: Group[];
}
