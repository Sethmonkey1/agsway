import "server-only";

import {
  loadHostedIntegrationSecrets,
  loadUnnotifiedOpportunities,
  markOpportunitiesNotified,
} from "./storage";
import type { MonitorSettings, Opportunity } from "./types";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function opportunityList(opportunities: Opportunity[]) {
  return opportunities.map((item) => `
    <div style="margin:0 0 16px;padding:16px;border:1px solid #e5e7eb;border-radius:10px">
      <div style="margin-bottom:6px;color:#64748b;font-size:12px">${escapeHtml(item.source.toUpperCase())} · ${escapeHtml(item.community)} · ${item.score}% match</div>
      <a href="${escapeHtml(item.url)}" style="color:#173f35;font-size:16px;font-weight:700;text-decoration:none">${escapeHtml(item.title)}</a>
      <p style="margin:8px 0 0;color:#475569;font-size:13px;line-height:1.5">${escapeHtml(item.excerpt.slice(0, 280))}</p>
    </div>
  `).join("");
}

export async function emailNewScanFindings(
  settings: MonitorSettings,
  scannedOpportunities: Opportunity[],
) {
  const recipient = settings.alertEmail;
  if (!settings.emailAlertsEnabled || scannedOpportunities.length === 0) {
    return { configured: false, sentCount: 0, recipient };
  }

  const integrations = await loadHostedIntegrationSecrets();
  const apiKey = integrations.resend || process.env.RESEND_API_KEY;
  if (!apiKey) return { configured: false, sentCount: 0, recipient };

  const unnotified = await loadUnnotifiedOpportunities(scannedOpportunities.map((item) => item.id));
  if (unnotified.length === 0) return { configured: true, sentCount: 0, recipient };

  const from = process.env.ALERT_EMAIL_FROM || "Swaya Agent <onboarding@resend.dev>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject: `Swaya found ${unnotified.length} new ${unnotified.length === 1 ? "opportunity" : "opportunities"}`,
      html: `
        <div style="margin:0 auto;max-width:680px;padding:24px;font-family:Arial,sans-serif">
          <h1 style="margin:0 0 8px;color:#173f35;font-size:24px">New Swaya opportunities</h1>
          <p style="margin:0 0 22px;color:#64748b">These conversations were newly discovered and saved to your Swaya inbox.</p>
          ${opportunityList(unnotified)}
        </div>
      `,
    }),
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`Email alert service returned ${response.status}.`);
  await markOpportunitiesNotified(unnotified.map((item) => item.id));
  return { configured: true, sentCount: unnotified.length, recipient };
}
