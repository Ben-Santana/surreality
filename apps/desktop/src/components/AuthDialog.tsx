import { LoaderCircle, LogOut, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  hideAuthDialog,
  recoverPassword,
  sendPasswordReset,
  setUsername,
  signIn,
  signOut,
  signUp,
  useAuthDialogOpen,
  useCloudState,
} from "../cloud";
import { BrandMark, UiButton, UiLabel } from "./ui/Chrome";

export default function AuthDialog() {
  const open = useAuthDialogOpen();
  const cloud = useCloudState();
  const [mode, setMode] = useState<"sign-in" | "sign-up" | "recovery">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsernameValue] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoverySent, setRecoverySent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await operation();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (mode === "recovery") {
        if (!recoverySent) {
          await sendPasswordReset(email.trim());
          setRecoverySent(true);
          setMessage("Enter the recovery code from your email and choose a new password.");
          return;
        }
        if (!/^\d{6}$/.test(recoveryCode.trim())) throw new Error("Enter the 6-digit recovery code.");
        if (password.length < 8) throw new Error("Use at least 8 characters for your new password.");
        await recoverPassword(email.trim(), recoveryCode.trim(), password);
      } else if (mode === "sign-up") {
        if (password.length < 8) throw new Error("Use at least 8 characters for your password.");
        const result = await signUp(email.trim(), password);
        if (result.needsEmailConfirmation) {
          setMessage("Check your email to confirm the account, then return here to sign in.");
          setMode("sign-in");
          return;
        }
      } else {
        await signIn(email.trim(), password);
      }
      hideAuthDialog();
    });
  };

  return (
    <div className="app-chrome fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-5 backdrop-blur-sm" onMouseDown={(event) => {
      if (event.target === event.currentTarget) hideAuthDialog();
    }}>
      <section role="dialog" aria-modal="true" aria-label="Surreality cloud account" className="w-full max-w-[430px] overflow-hidden rounded-[6px] border border-white/15 bg-[#101013] shadow-2xl">
        <header className="flex h-14 items-center justify-between border-b border-white/10 px-5">
          <div className="flex items-center gap-3"><BrandMark size={28} /><UiLabel>SURREALITY CLOUD</UiLabel></div>
          <UiButton tone="quiet" type="button" aria-label="Close" onClick={hideAuthDialog} className="size-8 min-h-0 p-0"><X className="size-4" /></UiButton>
        </header>

        {!cloud.configured ? (
          <div className="space-y-4 p-6">
            <h2 className="text-xl font-medium text-white">Cloud setup required</h2>
            <p className="text-[13px] leading-relaxed text-white/50">Add your Supabase project URL and publishable key to <span className="font-mono text-white/70">apps/desktop/.env.local</span>, then restart the app. Follow <span className="font-mono text-white/70">SUPABASE_SETUP.md</span>.</p>
          </div>
        ) : cloud.user ? (
          <div className="space-y-5 p-6">
            <div><p className="chrome-label">Signed in</p><p className="mt-2 truncate text-[15px] text-white">{cloud.user.email ?? "Surreality user"}</p></div>
            <div className="border border-white/10 bg-white/[0.025] p-3"><p className="text-[11px] leading-relaxed text-white/50">Spaces and media stay on this computer. Your account is used for publishing packages and keeping community download history.</p></div>
            <label className="block space-y-1.5"><span className="chrome-label">Public username</span><div className="flex gap-2"><input placeholder={cloud.profile?.username ?? "your-name"} value={username} onChange={(event) => setUsernameValue(event.target.value.toLowerCase())} className="panel-field h-10 min-w-0 flex-1 px-3 text-[13px] text-white outline-none" /><button type="button" disabled={busy || !username.trim()} onClick={() => void run(async () => { await setUsername(username.trim()); setUsernameValue(""); })} className="h-10 bg-accent px-4 text-[11px] font-semibold text-black disabled:opacity-40">Save</button></div></label>
            {cloud.lastError ? <p className="text-[12px] leading-relaxed text-danger">{cloud.lastError}</p> : null}
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={() => void run(async () => { await signOut(); })} className="flex h-10 flex-1 items-center justify-center gap-2 border border-white/15 px-3 text-[12px] text-white/65 hover:bg-white/10">
                <LogOut className="size-3.5" /> Sign out
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 p-6">
            <div><h2 className="text-xl font-medium text-white">{mode === "sign-in" ? "Join the community" : mode === "sign-up" ? "Create your account" : "Reset your password"}</h2><p className="mt-2 text-[12px] leading-relaxed text-white/42">{mode === "recovery" ? "Request a one-time recovery code, then choose a new password." : "Browse without an account, or sign in to publish packages and keep download history."}</p></div>
            <label className="block space-y-1.5"><span className="chrome-label">Email</span><input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="panel-field h-10 w-full px-3 text-[13px] text-white outline-none" /></label>
            {mode === "recovery" && recoverySent ? <label className="block space-y-1.5"><span className="chrome-label">Recovery code</span><input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value.replace(/\D/g, ""))} className="panel-field h-10 w-full px-3 font-mono text-[13px] text-white outline-none" /></label> : null}
            {mode !== "recovery" || recoverySent ? <label className="block space-y-1.5"><span className="chrome-label">{mode === "recovery" ? "New password" : "Password"}</span><input required minLength={8} type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="panel-field h-10 w-full px-3 text-[13px] text-white outline-none" /></label> : null}
            {message ? <p className="text-[12px] leading-relaxed text-accent">{message}</p> : null}
            {error ? <p className="text-[12px] leading-relaxed text-danger">{error}</p> : null}
            <UiButton tone="primary" type="submit" disabled={busy} className="h-10 w-full gap-2">{busy ? <LoaderCircle className="size-4 animate-spin" /> : null}{mode === "sign-in" ? "Sign in" : mode === "sign-up" ? "Create account" : recoverySent ? "Set new password" : "Send recovery code"}</UiButton>
            <div className="flex items-center justify-between gap-4 text-[11px] text-white/40">
              <button type="button" onClick={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setRecoverySent(false); setRecoveryCode(""); setError(null); setMessage(null); }} className="hover:text-white">{mode === "sign-in" ? "Create an account" : "Back to sign in"}</button>
              {mode === "sign-in" ? <button type="button" onClick={() => { setMode("recovery"); setError(null); setMessage(null); }} className="hover:text-white">Reset password</button> : null}
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
