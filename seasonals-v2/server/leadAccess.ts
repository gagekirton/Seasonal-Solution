import type { User } from "../drizzle/schema";

export type LeadAdminIdentity = Pick<User, "openId" | "role"> & {
  email?: string | null;
};

/**
 * Public contact details are never an authorization credential. Site access is
 * granted by an explicitly configured owner identity or an admin role.
 */
export function canAccessLeadInbox(
  user: LeadAdminIdentity,
  ownerOpenId: string
): boolean {
  return (
    user.role === "admin" || Boolean(ownerOpenId && user.openId === ownerOpenId)
  );
}
