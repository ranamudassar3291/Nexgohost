import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Loader2, Mail, CheckCircle2, AlertCircle } from "lucide-react";

export default function ForgotPassword() {
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [fieldErr,setFieldErr]= useState<string | null>(null);

  const validate = () => {
    if (!email.trim()) { setFieldErr("Email address is required."); return false; }
    if (!/\S+@\S+\.\S+/.test(email)) { setFieldErr("Enter a valid email address."); return false; }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#701AFE] flex items-center justify-center mb-3 shadow-lg shadow-[#701AFE]/30">
            <img src={`${import.meta.env.BASE_URL}images/logo-icon.png`} alt="Noehost" className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl shadow-lg shadow-black/5 p-8">
          <AnimatePresence mode="wait">

            {/* ── Email form ── */}
            {!sent && (
              <motion.div key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="mb-6">
                  <h1 className="text-2xl font-bold text-black">Forgot your password?</h1>
                  <p className="text-gray-500 text-sm mt-1.5">
                    No worries — enter your email and we'll send you a reset link.
                  </p>
                </div>

                {error && (
                  <div className="flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 mb-5">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setFieldErr(null); setError(null); }}
                      placeholder="you@example.com"
                      className={`w-full h-11 px-4 rounded-xl border text-sm text-black placeholder-gray-400 outline-none transition-all focus:ring-2 focus:ring-[#701AFE]/25 focus:border-[#701AFE] bg-white ${fieldErr ? "border-red-400 bg-red-50" : "border-gray-200"}`}
                    />
                    {fieldErr && <p className="mt-1.5 text-xs text-red-500">{fieldErr}</p>}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 rounded-xl bg-[#701AFE] hover:bg-[#5e14d4] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 shadow-md shadow-[#701AFE]/25"
                  >
                    {loading ? (
                      <><Loader2 size={17} className="animate-spin" /><span>Sending…</span></>
                    ) : (
                      <><Mail size={16} /><span>Send Reset Link</span></>
                    )}
                  </button>
                </form>

                <div className="mt-5 text-center">
                  <a href="/client/login" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#701AFE] transition-colors">
                    <ArrowLeft size={14} /> Back to login
                  </a>
                </div>
              </motion.div>
            )}

            {/* ── Success state ── */}
            {sent && (
              <motion.div key="sent" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-4">
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <CheckCircle2 size={32} className="text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-black mb-2">Check your inbox</h2>
                <p className="text-gray-500 text-sm mb-1">
                  We've sent a password reset link to
                </p>
                <p className="text-black font-medium text-sm mb-6">{email}</p>
                <p className="text-gray-400 text-xs mb-8">
                  The link expires in 1 hour. If you don't see it, check your spam folder.
                </p>
                <button
                  onClick={() => { setSent(false); setEmail(""); }}
                  className="text-sm text-[#701AFE] hover:underline"
                >
                  Try a different email
                </button>
                <div className="mt-4">
                  <a href="/client/login" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#701AFE] transition-colors">
                    <ArrowLeft size={14} /> Back to login
                  </a>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
