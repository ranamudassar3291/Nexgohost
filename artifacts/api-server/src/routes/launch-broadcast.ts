import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { authenticate, requireAdmin } from "../lib/auth.js";
import { sendEmail } from "../lib/email.js";

const router = Router();

function buildLaunchEmailHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Noehost is Officially LIVE!</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f8;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(124,58,237,0.10);">

          <!-- HEADER -->
          <tr>
            <td style="background:linear-gradient(135deg,#7C3AED 0%,#5B21B6 100%);padding:40px 48px 36px;text-align:center;">
              <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:12px;padding:10px 20px;margin-bottom:20px;">
                <span style="color:#fff;font-size:14px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">Official Launch Announcement</span>
              </div>
              <h1 style="margin:0;color:#ffffff;font-size:32px;font-weight:800;line-height:1.2;letter-spacing:-0.5px;">🚀 Noehost is<br/>Officially LIVE!</h1>
              <p style="margin:14px 0 0;color:rgba(255,255,255,0.85);font-size:16px;">Premium Hosting — Redefined for Pakistan</p>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:40px 48px;">

              <p style="margin:0 0 20px;color:#374151;font-size:17px;font-weight:600;line-height:1.6;">
                Assalam-o-Alaikum! 🌟
              </p>

              <p style="margin:0 0 20px;color:#4B5563;font-size:15px;line-height:1.8;">
                Humein yeh batate hue bohot khushi ho rahi hai ke <strong style="color:#7C3AED;">Noehost</strong> ki brand new, high-speed premium website officially launch ho chuki hai!
              </p>

              <p style="margin:0 0 20px;color:#4B5563;font-size:15px;line-height:1.8;">
                Hamare naye platform par aapko milega:
              </p>

              <!-- FEATURES -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr>
                  <td style="padding:10px 16px;background:#faf5ff;border-left:3px solid #7C3AED;border-radius:0 8px 8px 0;margin-bottom:8px;display:block;">
                    <span style="color:#7C3AED;font-weight:700;">⚡ Blazing Fast Servers</span><br/>
                    <span style="color:#6B7280;font-size:13px;">NVMe SSD storage with 99.9% uptime guarantee</span>
                  </td>
                </tr>
                <tr><td style="height:8px;"></td></tr>
                <tr>
                  <td style="padding:10px 16px;background:#faf5ff;border-left:3px solid #7C3AED;border-radius:0 8px 8px 0;">
                    <span style="color:#7C3AED;font-weight:700;">🔒 Free SSL & Security</span><br/>
                    <span style="color:#6B7280;font-size:13px;">Let's Encrypt SSL + DDoS protection on every plan</span>
                  </td>
                </tr>
                <tr><td style="height:8px;"></td></tr>
                <tr>
                  <td style="padding:10px 16px;background:#faf5ff;border-left:3px solid #7C3AED;border-radius:0 8px 8px 0;">
                    <span style="color:#7C3AED;font-weight:700;">🌐 .pk & International Domains</span><br/>
                    <span style="color:#6B7280;font-size:13px;">Register your dream domain at unbeatable prices</span>
                  </td>
                </tr>
                <tr><td style="height:8px;"></td></tr>
                <tr>
                  <td style="padding:10px 16px;background:#faf5ff;border-left:3px solid #7C3AED;border-radius:0 8px 8px 0;">
                    <span style="color:#7C3AED;font-weight:700;">📞 24/7 Local Support</span><br/>
                    <span style="color:#6B7280;font-size:13px;">Dedicated Urdu & English support team, always available</span>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 28px;color:#4B5563;font-size:15px;line-height:1.8;">
                Yeh sirf ek website nahi — yeh Pakistan ke digital future ka ek naya chapter hai. Aap hamare trust karne waale clients mein se hain, isliye aap sabse pehle yeh experience kar sakte hain. 🇵🇰
              </p>

              <!-- CTA BUTTON -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 32px;">
                    <a href="https://www.noehost.com" target="_blank"
                       style="display:inline-block;background:linear-gradient(135deg,#7C3AED,#5B21B6);color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:16px 48px;border-radius:50px;box-shadow:0 8px 24px rgba(124,58,237,0.35);letter-spacing:0.3px;">
                      🌐 Visit Noehost Now →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- DIVIDER -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-top:1px solid #E5E7EB;padding-top:28px;">
                    <p style="margin:0 0 12px;color:#4B5563;font-size:14px;line-height:1.7;">
                      Hamare saath rehne ke liye shukriya. Aapka har ek feedback, har ek order — hamari journey ka hissa hai.
                    </p>
                    <p style="margin:0;color:#4B5563;font-size:14px;line-height:1.7;">
                      Jazak Allah Khair! 🤲
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- SIGNATURE -->
          <tr>
            <td style="padding:0 48px 32px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:20px 24px;background:#faf5ff;border-radius:12px;border:1px solid #EDE9FE;">
                    <p style="margin:0 0 4px;color:#7C3AED;font-size:16px;font-weight:800;">Muhammad Arsalan</p>
                    <p style="margin:0 0 2px;color:#6D28D9;font-size:13px;font-weight:600;">Founder, Noehost 👑</p>
                    <p style="margin:0;color:#9CA3AF;font-size:12px;">noehost.com · Premium Pakistani Hosting</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#F9FAFB;border-top:1px solid #E5E7EB;padding:20px 48px;text-align:center;">
              <p style="margin:0 0 6px;color:#9CA3AF;font-size:12px;">You're receiving this because you have an account on Noehost.</p>
              <p style="margin:0;color:#9CA3AF;font-size:12px;">
                <a href="https://www.noehost.com" style="color:#7C3AED;text-decoration:none;">noehost.com</a>
                &nbsp;·&nbsp;
                <a href="https://www.noehost.com/contact-us" style="color:#7C3AED;text-decoration:none;">Contact Us</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

router.post("/admin/launch-broadcast", authenticate, requireAdmin, async (req, res) => {
  try {
    const allUsers = await db
      .select({ id: usersTable.id, email: usersTable.email, firstName: usersTable.firstName })
      .from(usersTable)
      .where(and(
        eq(usersTable.role, "client"),
        isNotNull(usersTable.email),
      ));

    if (allUsers.length === 0) {
      return res.json({ success: true, sent: 0, failed: 0, total: 0, message: "No clients found." });
    }

    const subject = "🚀 Noehost is Officially LIVE: Upgrade Your Digital Infrastructure Now!";
    const html = buildLaunchEmailHtml();

    let sent = 0;
    let failed = 0;

    for (const user of allUsers) {
      if (!user.email) continue;
      try {
        const result = await sendEmail({
          to: user.email,
          subject,
          html,
          emailType: "launch-broadcast",
          clientId: String(user.id),
        });
        if (result.sent) sent++;
        else failed++;
      } catch {
        failed++;
      }
      await sleep(200);
    }

    console.log(`[BROADCAST] Launch email sent: ${sent} ok, ${failed} failed out of ${allUsers.length} clients`);

    res.json({
      success: true,
      sent,
      failed,
      total: allUsers.length,
      message: `Broadcast complete: ${sent} sent, ${failed} failed.`,
    });
  } catch (err: any) {
    console.error("[BROADCAST] Fatal error:", err.message);
    res.status(500).json({ success: false, error: err.message || "Broadcast failed." });
  }
});

export default router;
