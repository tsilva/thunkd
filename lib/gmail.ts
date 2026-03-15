import { getValidAccessToken } from "./auth";
import { mockServicesEnabled } from "./dev-mode";

function base64url(str: string): string {
  return btoa(str)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function buildRfc2822(to: string, subject: string, body: string): string {
  const lines = [
    `To: ${to}`,
    `From: ${to}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    "",
    btoa(unescape(encodeURIComponent(body))),
  ];
  return lines.join("\r\n");
}

export async function sendEmail(
  text: string,
  userEmail: string,
): Promise<void> {
  if (mockServicesEnabled) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    console.info("[mock-send]", { to: userEmail, text });
    return;
  }

  const token = await getValidAccessToken();
  const subject = text.length > 60 ? text.slice(0, 60) + "\u2026" : text;
  const raw = base64url(buildRfc2822(userEmail, subject, text));

  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gmail API error (${res.status}): ${body}`);
  }
}
