import { z } from "zod";

export const CreateDiagramSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  blueprintId: z.string().optional(),
});

export const UpdateDiagramSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
});

export const SaveGraphSchema = z.object({
  graphData: z.string(),
});

export const CreateShareSchema = z.object({
  expiresIn: z.number().int().positive().optional(),
});

export type CreateDiagramInput = z.infer<typeof CreateDiagramSchema>;
export type UpdateDiagramInput = z.infer<typeof UpdateDiagramSchema>;
export type SaveGraphInput = z.infer<typeof SaveGraphSchema>;
export type CreateShareInput = z.infer<typeof CreateShareSchema>;

export function apiSuccess<T>(data: T) {
  return { ok: true as const, data };
}

export function apiError(code: string, message: string, status = 400) {
  return {
    body: { ok: false as const, error: { code, message } },
    status,
  };
}
