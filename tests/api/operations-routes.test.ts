import { describe, expect, it } from "vitest";

import { GET as exportAudit } from "../../app/api/audit/export/route";
import { GET as getOrder, PATCH as patchOrder } from "../../app/api/orders/[orderId]/route";
import { POST as approvePurchaseOrder } from "../../app/api/purchase-orders/[purchaseOrderId]/approve/route";
import { GET as getPurchaseOrders, POST as postPurchaseOrder } from "../../app/api/purchase-orders/route";
import { GET as getInvoices, POST as postInvoice } from "../../app/api/invoices/route";
import { GET as getOrders } from "../../app/api/orders/route";
import { GET as getQuote, PATCH as patchQuote } from "../../app/api/quotes/[quoteId]/route";
import { POST as convertQuote } from "../../app/api/quotes/[quoteId]/convert-to-order/route";
import { GET as getQuotes, POST as postQuote } from "../../app/api/quotes/route";
import { POST as postSupportTicket, GET as getSupportTickets } from "../../app/api/support/tickets/route";
import { GET as getUserHistory } from "../../app/api/user/history/route";

describe("operations routes", () => {
  it("lists orders and updates order status", async () => {
    const listResponse = await getOrders(new Request("http://localhost/api/orders"));
    const listPayload = await listResponse.json();
    const orderId = listPayload.data.items[0].id;

    const updateResponse = await patchOrder(
      new Request(`http://localhost/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "enviado", trackingNumber: "TRACK-1" })
      }),
      { params: Promise.resolve({ orderId }) }
    );

    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({
      success: true,
      data: {
        id: orderId,
        status: "enviado",
        trackingNumber: "TRACK-1"
      }
    });

    const detailResponse = await getOrder(
      new Request(`http://localhost/api/orders/${orderId}`),
      { params: Promise.resolve({ orderId }) }
    );
    expect(detailResponse.status).toBe(200);
  });

  it("creates a quote, updates it, and converts it to an order", async () => {
    const createResponse = await postQuote(
      new Request("http://localhost/api/quotes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "compras@sprint4.cl",
          items: [{ productId: "prod-hardware-ia", sku: "HW-IA-001", name: "Nexus", quantity: 1 }],
          shippingAddress: {
            firstName: "Ana",
            lastName: "Sprint",
            addressLine1: "Empresa Sprint",
            city: "Santiago",
            postalCode: "7500000",
            country: "CL",
            phone: "+56911111111"
          },
          paymentMethod: "cash_on_delivery"
        })
      })
    );
    const createPayload = await createResponse.json();
    const quoteId = createPayload.data.quoteId;

    const updateResponse = await patchQuote(
      new Request(`http://localhost/api/quotes/${quoteId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "aprobado_vendedor" })
      }),
      { params: Promise.resolve({ quoteId }) }
    );
    expect(updateResponse.status).toBe(200);

    const detailResponse = await getQuote(
      new Request(`http://localhost/api/quotes/${quoteId}`),
      { params: Promise.resolve({ quoteId }) }
    );
    expect(detailResponse.status).toBe(200);

    const convertResponse = await convertQuote(
      new Request(`http://localhost/api/quotes/${quoteId}/convert-to-order`, { method: "POST" }),
      { params: Promise.resolve({ quoteId }) }
    );
    expect(convertResponse.status).toBe(201);
    await expect(convertResponse.json()).resolves.toMatchObject({
      success: true,
      data: {
        order: {
          customerEmail: "compras@sprint4.cl"
        }
      }
    });

    const quotesResponse = await getQuotes(new Request("http://localhost/api/quotes?customerEmail=compras@sprint4.cl"));
    await expect(quotesResponse.json()).resolves.toMatchObject({
      success: true,
      data: {
        total: 1
      }
    });
  });

  it("creates support tickets and exposes user history", async () => {
    const supportResponse = await postSupportTicket(
      new Request("http://localhost/api/support/tickets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "problema_tecnico",
          name: "Cliente Soporte",
          organization: "Laboratorio Soporte",
          email: "soporte@sprint4.cl",
          phone: "+56922222222",
          equipment: "Servidor IA",
          serial: "SER-1",
          comment: "No inicia correctamente"
        })
      })
    );

    expect(supportResponse.status).toBe(201);
    await expect(supportResponse.json()).resolves.toMatchObject({
      success: true,
      data: {
        ticket: {
          status: "nuevo",
          email: "soporte@sprint4.cl"
        }
      }
    });

    const ticketsResponse = await getSupportTickets(
      new Request("http://localhost/api/support/tickets?email=soporte@sprint4.cl")
    );
    await expect(ticketsResponse.json()).resolves.toMatchObject({
      success: true,
      data: {
        total: 1
      }
    });

    const historyResponse = await getUserHistory(
      new Request("http://localhost/api/user/history?customerEmail=soporte@sprint4.cl")
    );
    await expect(historyResponse.json()).resolves.toMatchObject({
      success: true,
      data: {
        supportTickets: [expect.objectContaining({ email: "soporte@sprint4.cl" })]
      }
    });
  });

  it("exports audit data as a downloadable CSV report", async () => {
    const response = await exportAudit(new Request("http://localhost/api/audit/export"));
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("protonlab-auditoria");
    expect(text).toContain('"type","id","status","customerEmail","createdAt","updatedAt"');
  });

  it("creates purchase orders, enforces role approval, and creates invoices", async () => {
    const ordersResponse = await getOrders(new Request("http://localhost/api/orders"));
    const ordersPayload = await ordersResponse.json();
    const orderId = ordersPayload.data.items[0].id;

    const purchaseOrderResponse = await postPurchaseOrder(
      new Request("http://localhost/api/purchase-orders", {
        method: "POST",
        headers: { "content-type": "application/json", "x-user-role": "socio" },
        body: JSON.stringify({
          sourceOrderId: orderId,
          buyerReference: "OC-CLIENTE-100",
          requestedBy: "Compras Cliente"
        })
      })
    );

    expect(purchaseOrderResponse.status).toBe(201);
    const purchaseOrderPayload = await purchaseOrderResponse.json();
    const purchaseOrderId = purchaseOrderPayload.data.id;
    expect(purchaseOrderPayload).toMatchObject({
      success: true,
      data: {
        sourceOrderId: orderId,
        status: "pendiente_aprobacion",
        approvals: []
      }
    });

    const forbiddenApproval = await approvePurchaseOrder(
      new Request(`http://localhost/api/purchase-orders/${purchaseOrderId}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-user-role": "socio" },
        body: JSON.stringify({ approved: true })
      }),
      { params: Promise.resolve({ purchaseOrderId }) }
    );
    expect(forbiddenApproval.status).toBe(403);

    const adminApproval = await approvePurchaseOrder(
      new Request(`http://localhost/api/purchase-orders/${purchaseOrderId}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-user-role": "admin" },
        body: JSON.stringify({ approved: true, notes: "Aprobada por administración" })
      }),
      { params: Promise.resolve({ purchaseOrderId }) }
    );

    expect(adminApproval.status).toBe(200);
    await expect(adminApproval.json()).resolves.toMatchObject({
      success: true,
      data: {
        status: "aprobada",
        approvals: [expect.objectContaining({ role: "admin", approved: true })]
      }
    });

    const invoiceResponse = await postInvoice(
      new Request("http://localhost/api/invoices", {
        method: "POST",
        headers: { "content-type": "application/json", "x-user-role": "admin" },
        body: JSON.stringify({
          sourceOrderId: orderId,
          purchaseOrderId,
          billingReference: "FAC-CLIENTE-100"
        })
      })
    );

    expect(invoiceResponse.status).toBe(201);
    await expect(invoiceResponse.json()).resolves.toMatchObject({
      success: true,
      data: {
        sourceOrderId: orderId,
        purchaseOrderId,
        status: "emitida",
        paymentStatus: "pendiente"
      }
    });

    const purchaseOrdersResponse = await getPurchaseOrders(new Request("http://localhost/api/purchase-orders"));
    await expect(purchaseOrdersResponse.json()).resolves.toMatchObject({
      success: true,
      data: { total: expect.any(Number) }
    });

    const invoicesResponse = await getInvoices(new Request("http://localhost/api/invoices"));
    await expect(invoicesResponse.json()).resolves.toMatchObject({
      success: true,
      data: { total: expect.any(Number) }
    });
  });
});
