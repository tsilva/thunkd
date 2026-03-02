const RESEND_API_KEY = process.env.EXPO_PUBLIC_RESEND_API_KEY;
const CAPTURE_EMAIL = process.env.EXPO_PUBLIC_CAPTURE_EMAIL;

export function isConfigured(): boolean {
  return Boolean(RESEND_API_KEY && CAPTURE_EMAIL);
}

export async function sendEmail(text: string): Promise<void> {
  if (!RESEND_API_KEY || !CAPTURE_EMAIL) {
    throw new Error("Missing EXPO_PUBLIC_RESEND_API_KEY or EXPO_PUBLIC_CAPTURE_EMAIL in .env");
  }

  const subject = text.length > 60 ? text.slice(0, 60) + "…" : text;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Mobile Capture <onboarding@resend.dev>",
      to: [CAPTURE_EMAIL],
      subject,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error (${res.status}): ${body}`);
  }
}
