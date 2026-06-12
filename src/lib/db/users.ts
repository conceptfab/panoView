import { readJsonFileWithDefault, writeJsonFile } from './json-store';
import { User, UsersData } from '@/types';
import { generateId, formatDate } from '@/utils/helpers';
import { usersDataSchema } from '@/utils/validation';

const USERS_FILE = 'users.json';

export async function getUsers(): Promise<User[]> {
  const data = await readJsonFileWithDefault<UsersData>(USERS_FILE, {
    users: [],
  });
  const validated = usersDataSchema.parse(data);
  return validated.users;
}

export async function getUserById(id: string): Promise<User | null> {
  const users = await getUsers();
  return users.find((u) => u.id === id) || null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const users = await getUsers();
  return (
    users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null
  );
}

export async function createUser(
  email: string,
  role: 'admin' | 'user' | 'editor' = 'user',
  groupIds: string[] = []
): Promise<User> {
  const users = await getUsers();

  const existing = users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase()
  );
  if (existing) {
    throw new Error('User with this email already exists');
  }

  const newUser: User = {
    id: generateId('user'),
    email: email.toLowerCase(),
    role,
    isActive: true,
    createdAt: formatDate(new Date()),
    lastLoginAt: null,
    groupIds,
  };

  users.push(newUser);
  await writeJsonFile<UsersData>(USERS_FILE, { users });
  return newUser;
}

export async function updateUser(
  id: string,
  updates: Partial<Omit<User, 'id' | 'email' | 'createdAt'>>
): Promise<User | null> {
  const users = await getUsers();
  const index = users.findIndex((u) => u.id === id);

  if (index === -1) return null;

  users[index] = { ...users[index], ...updates };
  await writeJsonFile<UsersData>(USERS_FILE, { users });
  return users[index];
}

export async function updateUserLastLogin(id: string): Promise<void> {
  await updateUser(id, { lastLoginAt: formatDate(new Date()) });
}

export async function deleteUser(id: string): Promise<boolean> {
  const users = await getUsers();
  const index = users.findIndex((u) => u.id === id);

  if (index === -1) return false;

  users.splice(index, 1);
  await writeJsonFile<UsersData>(USERS_FILE, { users });
  return true;
}
