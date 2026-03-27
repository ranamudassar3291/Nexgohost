/**
 * AI Support Desk — Auto-reply generator
 * Uses OpenAI (via Replit AI Integrations) to generate initial support ticket replies.
 */
import OpenAI from "openai";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    const apiKey  = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    if (!baseURL || !apiKey) {
      throw new Error("AI_INTEGRATIONS_OPENAI_BASE_URL / AI_INTEGRATIONS_OPENAI_API_KEY not configured");
    }
    _client = new OpenAI({ baseURL, apiKey });
  }
  return _client;
}

const SYSTEM_PROMPT = `You are a friendly, professional support agent for Noehost — a leading web hosting and domain management platform.
Your role is to provide an immediate, helpful first response to a new support ticket.

Guidelines:
- Be warm but concise (2–4 short paragraphs max)
- Acknowledge the specific issue the client mentioned
- Provide 1–3 practical next steps or troubleshooting tips if applicable
- Mention that a human agent will follow up within 24 hours for complex issues
- Sign off as "Noehost Support Team"
- Do NOT invent specific technical details you don't know
- Do NOT make promises about pricing, upgrades, or deadlines you can't guarantee
- Write in plain, professional English`;

export async function generateAiSupportReply(
  subject: string,
  userMessage: string,
  department: string = "General"
): Promise<string | null> {
  try {
    const openai = getClient();
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 500,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Support ticket received:\n\nDepartment: ${department}\nSubject: ${subject}\n\nClient message:\n${userMessage}`,
        },
      ],
    });
    return response.choices[0]?.message?.content?.trim() ?? null;
  } catch (err: any) {
    console.error("[AI SUPPORT] Auto-reply generation failed:", err.message);
    return null;
  }
}
