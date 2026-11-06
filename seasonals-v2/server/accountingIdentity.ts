import { createHash } from "crypto";

/** Same logical create reuses one Intuit requestid (maximum 50 characters). */
export function accountingRequestId(
  namespace: string,
  realmId: string,
  entity: string,
  localId: string,
  variant = "primary"
): string {
  return createHash("sha256")
    .update(
      JSON.stringify([namespace, realmId, entity, localId, variant, "v1"])
    )
    .digest("hex")
    .slice(0, 48);
}
