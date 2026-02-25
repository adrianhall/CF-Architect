import type { AuthStrategy, AppUser } from "./types";
import { SEED_USER_ID } from "./types";

const seedUser: AppUser = {
  id: SEED_USER_ID,
  email: null,
  displayName: "Default User",
  avatarUrl: null,
};

export const bypassAuth: AuthStrategy = {
  async resolveUser() {
    return seedUser;
  },
};
