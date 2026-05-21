import React from "react";
import StatusDashboard from "./StatusDashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function HomePage() {
  return (
    <main className="status-shell">
      <StatusDashboard />
    </main>
  );
}
