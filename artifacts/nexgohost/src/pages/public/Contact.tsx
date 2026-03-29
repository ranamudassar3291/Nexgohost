import { useState } from "react";
import { Link } from "wouter";

const COMPANY   = "Noehost";
const EMAIL     = "support@noehost.com";
const BILLING   = "billing@noehost.com";
const WA_NUM    = "923151711821";
const WA_URL    = `https://wa.me/${WA_NUM}`;
const BRAND     = "#4F46E5";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      const token = localStorage.getItem("token") ?? "";
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to send. Please email us directly.");
      }
      setSent(true);
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%)" }} className="py-14 px-4 text-white text-center">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)" }}>
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            </div>
            <h1 className="text-3xl font-bold">Contact {COMPANY}</h1>
          </div>
          <p className="text-white/80 text-sm">We typically respond within a few hours during business hours (Mon–Sat, 9 AM – 10 PM PKT)</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          {/* ── Contact channels ── */}
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-gray-800">Get in Touch</h2>

            {/* WhatsApp */}
            <a
              href={WA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-4 p-5 rounded-2xl border border-green-100 bg-green-50 hover:bg-green-100 transition-colors group"
            >
              <div className="w-11 h-11 rounded-xl bg-green-500 flex items-center justify-center shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.128.558 4.127 1.534 5.864L.054 23.543a.5.5 0 00.615.608l5.879-1.543A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.6a9.593 9.593 0 01-5.014-1.413l-.36-.213-3.49.916.933-3.397-.234-.37A9.565 9.565 0 012.4 12C2.4 6.698 6.698 2.4 12 2.4S21.6 6.698 21.6 12 17.302 21.6 12 21.6z"/></svg>
              </div>
              <div>
                <p className="font-semibold text-green-800 group-hover:text-green-900">WhatsApp Support</p>
                <p className="text-sm text-green-700 mt-0.5">+92 315 1711821</p>
                <p className="text-xs text-green-600 mt-1">Fastest response — usually within minutes</p>
              </div>
            </a>

            {/* Support Email */}
            <a
              href={`mailto:${EMAIL}`}
              className="flex items-start gap-4 p-5 rounded-2xl border border-violet-100 bg-violet-50 hover:bg-violet-100 transition-colors group"
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: BRAND }}>
                <svg width="20" height="20" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
              </div>
              <div>
                <p className="font-semibold text-violet-800">Technical Support</p>
                <p className="text-sm text-violet-700 mt-0.5">{EMAIL}</p>
                <p className="text-xs text-violet-600 mt-1">Hosting, domain & account issues</p>
              </div>
            </a>

            {/* Billing Email */}
            <a
              href={`mailto:${BILLING}`}
              className="flex items-start gap-4 p-5 rounded-2xl border border-blue-100 bg-blue-50 hover:bg-blue-100 transition-colors group"
            >
              <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                <svg width="20" height="20" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
              </div>
              <div>
                <p className="font-semibold text-blue-800">Billing & Payments</p>
                <p className="text-sm text-blue-700 mt-0.5">{BILLING}</p>
                <p className="text-xs text-blue-600 mt-1">Invoice queries & payment issues</p>
              </div>
            </a>

            {/* Hours */}
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
              <p className="text-sm font-semibold text-gray-700 mb-2">Business Hours (PKT)</p>
              <p className="text-xs text-gray-500">Monday – Saturday: 9:00 AM – 10:00 PM</p>
              <p className="text-xs text-gray-500 mt-1">Sunday: Limited support via WhatsApp</p>
            </div>

            {/* Back link */}
            <Link href="/" className="text-sm text-violet-600 hover:underline flex items-center gap-1">
              ← Back to home
            </Link>
          </div>

          {/* ── Contact form ── */}
          <div className="md:col-span-2">
            <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
              {sent ? (
                <div className="text-center py-10">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <svg width="32" height="32" fill="none" stroke="#16a34a" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Message Sent!</h3>
                  <p className="text-gray-500 text-sm mb-6">We'll get back to you within a few hours. Check your email for our reply.</p>
                  <a
                    href={WA_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.128.558 4.127 1.534 5.864L.054 23.543a.5.5 0 00.615.608l5.879-1.543A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.6a9.593 9.593 0 01-5.014-1.413l-.36-.213-3.49.916.933-3.397-.234-.37A9.565 9.565 0 012.4 12C2.4 6.698 6.698 2.4 12 2.4S21.6 6.698 21.6 12 17.302 21.6 12 21.6z"/></svg>
                    Chat on WhatsApp Instead
                  </a>
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-gray-800 mb-6">Send Us a Message</h2>
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Your Name *</label>
                        <input
                          type="text"
                          required
                          value={form.name}
                          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                          placeholder="Ali Hassan"
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Email Address *</label>
                        <input
                          type="email"
                          required
                          value={form.email}
                          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                          placeholder="you@example.com"
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700">Subject *</label>
                      <select
                        required
                        value={form.subject}
                        onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      >
                        <option value="">Select a topic…</option>
                        <option value="Technical Support">Technical Support</option>
                        <option value="Billing & Payment">Billing &amp; Payment</option>
                        <option value="Domain Registration">Domain Registration</option>
                        <option value="Account Issue">Account Issue</option>
                        <option value="Upgrade / Downgrade Plan">Upgrade / Downgrade Plan</option>
                        <option value="Cancellation & Refund">Cancellation &amp; Refund</option>
                        <option value="General Inquiry">General Inquiry</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700">Message *</label>
                      <textarea
                        required
                        rows={5}
                        value={form.message}
                        onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                        placeholder="Please describe your issue or question in detail…"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
                      />
                    </div>

                    {error && (
                      <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">{error}</div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-4 items-center pt-1">
                      <button
                        type="submit"
                        disabled={sending}
                        className="px-8 py-3 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed w-full sm:w-auto"
                        style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)" }}
                      >
                        {sending ? "Sending…" : "Send Message"}
                      </button>
                      <a
                        href={WA_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-green-600 font-semibold hover:text-green-700"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.128.558 4.127 1.534 5.864L.054 23.543a.5.5 0 00.615.608l5.879-1.543A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.6a9.593 9.593 0 01-5.014-1.413l-.36-.213-3.49.916.933-3.397-.234-.37A9.565 9.565 0 012.4 12C2.4 6.698 6.698 2.4 12 2.4S21.6 6.698 21.6 12 17.302 21.6 12 21.6z"/></svg>
                        Or chat on WhatsApp
                      </a>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
