import { z } from "zod";

export const BudgetActionSchema = z.discriminatedUnion("intent", [
  z.object({ intent: z.literal("clear") }),
  z.object({
    intent: z.literal("set"),
    usd: z.coerce.number().finite().min(0).max(1_000_000_000),
  }),
]);
