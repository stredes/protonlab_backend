import { z } from "zod";

export const sqlAssistantRequestSchema = z.object({
  question: z.string().min(1),
  schema: z.string().min(1),
  dialect: z.string().min(1).optional(),
  businessContext: z.string().min(1).optional()
});

export type SqlAssistantRequest = z.infer<typeof sqlAssistantRequestSchema>;
