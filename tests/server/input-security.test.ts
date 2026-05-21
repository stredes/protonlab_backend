import { describe, expect, it } from "vitest";

import { GET as exportAudit } from "../../app/api/audit/export/route";
import { GET as getOrders } from "../../app/api/orders/route";
import { PATCH as patchOrder } from "../../app/api/orders/[orderId]/route";
import { POST as postSupportTicket } from "../../app/api/support/tickets/route";
import { PATCH as patchSupportTicket } from "../../app/api/support/tickets/[ticketId]/route";
import { safeCsvCell } from "../../src/server/input-security";

describe("portal input security", () => {
  it("rejects html or script content submitted through support tickets", async () => {
    const response = await postSupportTicket(
      new Request("http://localhost/api/support/tickets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "problema_tecnico",
          name: "Cliente Soporte",
          organization: "Laboratorio Soporte",
          email: "soporte-seguridad@sprint4.cl",
          equipment: "Servidor IA",
          comment: "<script>alert('xss')</script>"
        })
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "VALIDATION_ERROR"
    });
  });

  it("rejects invalid support ticket emails", async () => {
    const response = await postSupportTicket(
      new Request("http://localhost/api/support/tickets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "problema_tecnico",
          name: "Cliente Soporte",
          organization: "Laboratorio Soporte",
          email: "correo-invalido",
          equipment: "Servidor IA",
          comment: "No inicia correctamente"
        })
      })
    );

    expect(response.status).toBe(400);
  });

  it("rejects prototype pollution keys in portal payloads", async () => {
    const response = await postSupportTicket(
      new Request("http://localhost/api/support/tickets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: `{
          "type": "problema_tecnico",
          "name": "Cliente Soporte",
          "organization": "Laboratorio Soporte",
          "email": "pollution@sprint4.cl",
          "equipment": "Servidor IA",
          "comment": "No inicia correctamente",
          "__proto__": { "polluted": true }
        }`
      })
    );

    expect(response.status).toBe(400);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("rejects manipulated order statuses", async () => {
    const listResponse = await getOrders(new Request("http://localhost/api/orders"));
    const listPayload = await listResponse.json();
    const orderId = listPayload.data.items[0].id;

    const response = await patchOrder(
      new Request(`http://localhost/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "entregado; DROP TABLE orders" })
      }),
      { params: Promise.resolve({ orderId }) }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "VALIDATION_ERROR"
    });
  });

  it("rejects manipulated support ticket workflow values", async () => {
    const createResponse = await postSupportTicket(
      new Request("http://localhost/api/support/tickets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "problema_tecnico",
          name: "Cliente Soporte",
          organization: "Laboratorio Soporte",
          email: "soporte-workflow@sprint4.cl",
          equipment: "Servidor IA",
          comment: "No inicia correctamente"
        })
      })
    );
    const createPayload = await createResponse.json();
    const ticketId = createPayload.data.ticket.id;

    const response = await patchSupportTicket(
      new Request(`http://localhost/api/support/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ priority: "alta<script>" })
      }),
      { params: Promise.resolve({ ticketId }) }
    );

    expect(response.status).toBe(400);
  });

  it("neutralizes csv formula injection in audit exports", async () => {
    const response = await exportAudit(new Request("http://localhost/api/audit/export"));
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toContain('"type","id","status","customerEmail","createdAt","updatedAt"');
    expect(safeCsvCell("=cmd|' /C calc'!A0")).toBe("'=cmd|' /C calc'!A0");
  });
});
