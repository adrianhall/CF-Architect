export interface AuthStrategy {
  resolveUser(request: Request, env: Env): Promise<AppUser | null>;
}

export interface AppUser {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export const SEED_USER_ID = "00000000-0000-0000-0000-000000000000";
