export type EmailConfig = {
  apiKey: string;
  captureEmail: string;
};

const ENV_API_KEY = process.env.EXPO_PUBLIC_RESEND_API_KEY;
const ENV_CAPTURE_EMAIL = process.env.EXPO_PUBLIC_CAPTURE_EMAIL;

export function isConfigured(config?: EmailConfig): boolean {
  const apiKey = config?.apiKey || ENV_API_KEY;
  const email = config?.captureEmail || ENV_CAPTURE_EMAIL;
  return Boolean(apiKey && email);
}

export async function sendEmail(
  text: string,
  config?: EmailConfig,
): Promise<void> {
  const apiKey = config?.apiKey || ENV_API_KEY;
  const email = config?.captureEmail || ENV_CAPTURE_EMAIL;

  if (!apiKey || !email) {
    throw new Error("Missing Resend API key or capture email");
  }

  const subject = text.length > 60 ? text.slice(0, 60) + "\u2026" : text;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Mobile Capture <onboarding@resend.dev>",
      to: [email],
      subject,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error (${res.status}): ${body}`);
  }
}
