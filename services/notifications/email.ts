import { createSupabaseServiceClient } from "@/lib/supabase/server";

type EmailInput = {
  userId: string;
  subject: string;
  body: string;
};

/** Send email via Resend when configured; otherwise no-op (in-app notifications still work). */
export async function sendNotificationEmail(input: EmailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.NOTIFICATION_FROM_EMAIL?.trim() ?? "notifications@zorino.com";
  if (!apiKey) return false;

  const supabase = createSupabaseServiceClient();
  if (!supabase) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", input.userId)
    .maybeSingle();

  const email = (profile as { email?: string } | null)?.email;
  if (!email) return false;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: email,
        subject: input.subject,
        text: input.body,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
