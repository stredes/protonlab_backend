import { fail, ok } from "../utils/responses";
import { quoteRequestSchema } from "../validation/quote";

export async function createQuote(request: Request): Promise<Response> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return fail("JSON inválido", {
      status: 400,
      code: "VALIDATION_ERROR",
      request
    });
  }

  const parsed = quoteRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return fail("Payload de cotización inválido", {
      status: 400,
      code: "VALIDATION_ERROR",
      request
    });
  }

  const itemCount = parsed.data.items.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  return ok(
    {
      quoteId: `quote_${crypto.randomUUID().slice(0, 8)}`,
      status: "pendiente",
      customerName: `${parsed.data.shippingAddress.firstName} ${parsed.data.shippingAddress.lastName}`,
      itemCount,
      requestedAt: new Date().toISOString()
    },
    request,
    201
  );
}
