import type { Request } from "express";
import { ENV } from "./env";
import { sdk } from "./sdk";
import { canAccessLeadInbox } from "../leadAccess";

/** Never grant CRM access from a contact email or an unconfigured fallback. */
export async function requireCrmAdministrator(req: Request) {
  try {
    const user = await sdk.authenticateRequest(req);
    return canAccessLeadInbox(user, ENV.ownerOpenId) ? user : null;
  } catch {
    return null;
  }
}

export function adminDeniedStatus(req: Request): 401 | 403 {
  return req.headers.cookie || req.headers.authorization ? 403 : 401;
}
