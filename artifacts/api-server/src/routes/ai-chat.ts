/**
 * AI Chat endpoint — powers the floating support chatbot in the client panel.
 * POST /ai/chat  { messages: [{role, content}] }
 */
import { Router } from "express";
import OpenAI from "openai";
import { authenticate } from "../lib/auth.js";

const router = Router();

function getClient(): OpenAI | null {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey  = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseURL || !apiKey) return null;
  return new OpenAI({ baseURL, apiKey });
}

const SYSTEM_PROMPT = `You are Noe, a friendly and knowledgeable AI support assistant for Noehost — a premium web hosting and domain management company.

You help clients with:
- Web hosting questions (shared, VPS, reseller, WordPress)
- Domain registration, transfers, DNS management
- Billing, invoices, and payment queries
- cPanel/control panel guidance
- WordPress, SSL, email setup
- Account and service management

Guidelines:
- Be concise, warm, and professional
- Answer in 2–4 sentences max per response
- For complex technical issues, suggest opening a support ticket
- For billing disputes, direct them to billing@noehost.com
- Never invent technical details you don't know
- Always sign off as Noe from Noehost Support`;

router.post("/ai/chat", authenticate, async (req, res) => {
  try {
    const { messages } = req.body as {
      messages: { role: "user" | "assistant"; content: string }[];
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array required" });
    }

    const client = getClient();
    if (!client) {
      return res.json({
        reply: "Hi! I'm Noe, your Noehost assistant. AI is not configured yet, but our support team is available 24/7 via live chat at support@noehost.com or WhatsApp.",
      });
    }

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 300,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages.slice(-10),
      ],
    });

    const reply = response.choices[0]?.message?.content?.trim() ?? "I'm here to help! Could you rephrase your question?";
    return res.json({ reply });
  } catch (err: any) {
    console.error("[AI CHAT]", err.message);
    return res.json({
      reply: "Sorry, I'm having a moment! Please contact our support team at support@noehost.com or WhatsApp for immediate assistance.",
    });
  }
});

export default router;
