import { z } from "zod";

// ---------------------------------------------------------------------------
// AdminAuditAction
// ---------------------------------------------------------------------------

export const AdminAuditAction = z.enum(["promote", "demote", "delete"]);
export type AdminAuditAction = z.infer<typeof AdminAuditAction>;

// ---------------------------------------------------------------------------
// AdminAuditEntry — row in admin_audit joined with the actor's email
// ---------------------------------------------------------------------------

export const AdminAuditEntry = z.object({
  id: z.string(),
  actorId: z.string(),
  /** Denormalised from the `users` table join. */
  actorEmail: z.string().email(),
  action: AdminAuditAction,
  targetId: z.string(),
  /**
   * Optional JSON string containing additional context for the action,
   * e.g. `{ "previousRole": "user" }`.
   */
  payloadJson: z.string().nullable(),
  /** Unix milliseconds — when the action was recorded. */
  at: z.number().int(),
});

export type AdminAuditEntry = z.infer<typeof AdminAuditEntry>;
