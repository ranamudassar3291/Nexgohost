import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, ArrowLeft, LockKeyhole } from "lucide-react";

export default function ResetPassword() {
  const [token,     setToken]     = useState("");
  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [showPwd,   setShowPwd]   = useState(false);
  const [showCfm,   setShowCfm]   = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [fieldErrs, setFieldErrs] = useState<{ password?: string; confirm?: string }>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t) setToken(t);
    else setError("Invalid or missing reset token. Please request a new link.");
  }, []);

  const validate = () => {
    const errs: typeof fieldErrs = {};
    if (!password)               errs.password = "Password is required.";
    else if (password.length < 8) errs.password = "Password must be at least 8 characters.";
    if (!confirm)                errs.confirm  = "Please confirm your new password.";
    else if (password !== confirm) errs.confirm = "Passwords do not match.";
    setFieldErrs(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed. Please try again.");
      setDone(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputCls = (field?: "password" | "confirm") =>
    `w-full h-11 px-4 rounded-xl border text-sm text-black placeholder-gray-400 outline-none transition-all focus:ring-2 focus:ring-[#701AFE]/25 focus:border-[#701AFE] bg-white pr-11 ${
      field && fieldErrs[field] ? "border-red-400 bg-red-50" : "border-gray-200"
    }`;

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

            {/* ── Reset form ── */}
            {!done && (
              <motion.div key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[#701AFE]/10 mb-5">
                  <LockKeyhole size={22} className="text-[#701AFE]" />
                </div>
                <h1 className="text-2xl font-bold text-black mb-1">Set new password</h1>
                <p className="text-gray-500 text-sm mb-6">
                  Choose a strong password for your Noehost account.
                </p>

                {error && (
                  <div className="flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 mb-5">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate className="space-y-4">
                  {/* New password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">New password</label>
                    <div className="relative">
                      <input
                        type={showPwd ? "text" : "password"}
                        value={password}
                        onChange={e => { setPassword(e.target.value); setFieldErrs(p => ({ ...p, password: undefined })); setError(null); }}
                        placeholder="Min. 8 characters"
                        className={inputCls("password")}
                      />
                      <button type="button" onClick={() => setShowPwd(p => !p)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                    {fieldErrs.password && <p className="mt-1.5 text-xs text-red-500">{fieldErrs.password}</p>}
                    {password.length >= 8 && !fieldErrs.password && (
                      <p className="mt-1.5 text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle2 size={11} /> Strong password
                      </p>
                    )}
                  </div>

                  {/* Confirm password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm new password</label>
                    <div className="relative">
                      <input
                        type={showCfm ? "text" : "password"}
                        value={confirm}
                        onChange={e => { setConfirm(e.target.value); setFieldErrs(p => ({ ...p, confirm: undefined })); }}
                        placeholder="Repeat your password"
                        className={inputCls("confirm")}
                      />
                      <button type="button" onClick={() => setShowCfm(p => !p)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showCfm ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                    {fieldErrs.confirm && <p className="mt-1.5 text-xs text-red-500">{fieldErrs.confirm}</p>}
                    {confirm && password === confirm && !fieldErrs.confirm && (
                      <p className="mt-1.5 text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle2 size={11} /> Passwords match
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !token}
                    className="w-full h-11 mt-1 rounded-xl bg-[#701AFE] hover:bg-[#5e14d4] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 shadow-md shadow-[#701AFE]/25"
                  >
                    {loading ? (
                      <><Loader2 size={17} className="animate-spin" /><span>Updating…</span></>
                    ) : (
                      "Update password"
                    )}
                  </button>
                </form>

                <div className="mt-5 text-center">
                  <a href="/forgot-password" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#701AFE] transition-colors">
                    <ArrowLeft size={14} /> Request a new link
                  </a>
                </div>
              </motion.div>
            )}

            {/* ── Success state ── */}
            {done && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-4">
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <CheckCircle2 size={32} className="text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-black mb-2">Password updated!</h2>
                <p className="text-gray-500 text-sm mb-8">
                  Your password has been reset successfully. You can now sign in with your new password.
                </p>
                <a
                  href="/client/login"
                  className="inline-flex items-center justify-center w-full h-11 rounded-xl bg-[#701AFE] hover:bg-[#5e14d4] text-white text-sm font-semibold transition-colors gap-2 shadow-md shadow-[#701AFE]/25"
                >
                  Sign in to your account
                </a>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
