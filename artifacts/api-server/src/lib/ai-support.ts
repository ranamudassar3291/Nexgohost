/**
 * AI Support Desk — Auto-reply generator with full knowledge context
 * Uses Gemini (via OpenAI-compatible API) to generate initial support ticket replies.
 * Knowledge context: hosting plans, KB articles, training docs, site content.
 */
import OpenAI from "openai";
import { db } from "@workspace/db";
import { hostingPlansTable, kbArticlesTable, settingsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
      || "https://generativelanguage.googleapis.com/v1beta/openai/";
    const apiKey  = process.env.GEMINI_API_KEY
      || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
    _client = new OpenAI({ baseURL, apiKey });
  }
  return _client;
}

async function buildKnowledgeContext(): Promise<string> {
  const parts: string[] = [];

  try {
    // 1. Hosting plans
    const plans = await db.select({
      name: hostingPlansTable.name,
      price: hostingPlansTable.price,
      yearlyPrice: hostingPlansTable.yearlyPrice,
      billingCycle: hostingPlansTable.billingCycle,
      description: hostingPlansTable.description,
      diskSpace: (hostingPlansTable as any).diskSpace,
      bandwidth: (hostingPlansTable as any).bandwidth,
      features: (hostingPlansTable as any).features,
    }).from(hostingPlansTable).limit(20).catch(() => []);

    if (plans.length > 0) {
      parts.push("=== HOSTING PLANS ===");
      for (const p of plans) {
        const price = p.yearlyPrice ? `Rs.${p.price}/mo or Rs.${p.yearlyPrice}/yr` : `Rs.${p.price}/${p.billingCycle || "mo"}`;
        const desc = p.description ? ` — ${p.description}` : "";
        parts.push(`• ${p.name} — ${price}${desc}`);
      }
    }
  } catch { /* non-fatal */ }

  try {
    // 2. KB articles
    const articles = await db.select({
      title: kbArticlesTable.title,
      content: kbArticlesTable.content,
    }).from(kbArticlesTable)
      .where(eq(kbArticlesTable.isPublished, true))
      .orderBy(desc((kbArticlesTable as any).views ?? kbArticlesTable.createdAt))
      .limit(15)
      .catch(() => []);

    if (articles.length > 0) {
      parts.push("\n=== KNOWLEDGE BASE ARTICLES ===");
      for (const a of articles) {
        const snippet = (a.content || "").slice(0, 300).replace(/\n+/g, " ");
        parts.push(`[${a.title}]: ${snippet}${snippet.length >= 300 ? "…" : ""}`);
      }
    }
  } catch { /* non-fatal */ }

  try {
    // 3. AI Training docs
    const rows = await db.select({
      title: sql<string>`title`,
      content: sql<string>`content`,
      docType: sql<string>`doc_type`,
    }).from(sql`ai_training_docs`)
      .where(sql`is_active = true`)
      .limit(15)
      .catch(() => []);

    if (rows.length > 0) {
      parts.push("\n=== SUPPORT TRAINING DOCUMENTS ===");
      for (const r of rows) {
        const snippet = (r.content || "").slice(0, 400).replace(/\n+/g, " ");
        parts.push(`[${r.docType?.toUpperCase() || "DOC"} — ${r.title}]: ${snippet}${snippet.length >= 400 ? "…" : ""}`);
      }
    }
  } catch { /* non-fatal */ }

  try {
    // 4. Company info / branding
    const settings = await db.select().from(settingsTable)
      .where(sql`key IN ('company_name','support_email','brand_whatsapp','brand_website')`)
      .catch(() => []);

    if (settings.length > 0) {
      const map = Object.fromEntries(settings.map(s => [s.key, s.value]));
      const company = map["company_name"] || "Noehost";
      const email   = map["support_email"] || "support@noehost.com";
      const wa      = map["brand_whatsapp"] ? ` | WhatsApp: ${map["brand_whatsapp"]}` : "";
      parts.unshift(`=== COMPANY INFO ===\nCompany: ${company} | Support: ${email}${wa}\n`);
    }
  } catch { /* non-fatal */ }

  return parts.join("\n");
}

const BASE_SYSTEM_PROMPT = `You are a knowledgeable, friendly, professional support agent.
Your role is to provide an IMMEDIATE, COMPLETE, and HELPFUL response to a new support ticket.

RESPONSE GUIDELINES:
- Be warm but direct — acknowledge the specific issue immediately
- Provide COMPLETE step-by-step solutions (not just vague advice)
- For technical issues: provide exact steps, commands, or settings paths
- For billing issues: explain the process clearly with next steps
- For domain/DNS: provide specific record values or settings when possible
- Keep responses under 5 short paragraphs
- Sign off as "Noehost Support Team"
- Use the knowledge base below to give accurate, specific answers about our services
- If the knowledge base has relevant info, USE IT — don't say "contact support" for things you can answer
- For complex issues needing server access, mention a human agent will follow up

FORMATTING (plain text — no HTML):
- Use paragraph breaks for readability
- Numbered steps for procedures
- Bullet points for options or lists`;

export async function generateAiSupportReply(
  subject: string,
  userMessage: string,
  department: string = "General"
): Promise<string | null> {
  try {
    const openai = getClient();
    const knowledgeCtx = await buildKnowledgeContext();

    const systemPrompt = knowledgeCtx
      ? `${BASE_SYSTEM_PROMPT}\n\n${knowledgeCtx}`
      : BASE_SYSTEM_PROMPT;

    const response = await openai.chat.completions.create({
      model: process.env.AI_MODEL || "gemini-2.0-flash",
      max_tokens: 700,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `New support ticket:\n\nDepartment: ${department}\nSubject: ${subject}\n\nClient message:\n${userMessage}\n\nPlease provide a thorough, helpful response that fully addresses the client's issue.`,
        },
      ],
    });
    return response.choices[0]?.message?.content?.trim() ?? null;
  } catch (err: any) {
    console.error("[AI SUPPORT] Auto-reply generation failed:", err.message);
    return null;
  }
}
