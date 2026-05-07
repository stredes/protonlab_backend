import { z } from "zod";

const quoteItemSchema = z.object({
  productId: z.string().min(1),
  sku: z.string().min(1),
  name: z.string().min(1),
  image: z.string().optional(),
  unitPrice: z.number().nonnegative().optional(),
  currency: z.literal("USD").optional(),
  quantity: z.number().int().positive(),
  brand: z.string().optional()
});

const addressSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().optional(),
  postalCode: z.string().min(1),
  country: z.string().min(1),
  phone: z.string().optional()
});

export const quoteRequestSchema = z.object({
  email: z.email(),
  items: z.array(quoteItemSchema).min(1),
  shippingAddress: addressSchema,
  billingAddress: addressSchema.optional(),
  paymentMethod: z.enum(["card", "paypal", "cash_on_delivery"]),
  notes: z.string().optional()
});

export type QuoteRequest = z.infer<typeof quoteRequestSchema>;
