import { useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowLeft,
  Check,
  Database,
  KeyRound,
  LogOut,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useStore } from "../store";

type AccountMode =
  | "sign-in"
  | "request-reset"
  | "reset-password"
  | "reset-sent";

function readResetToken() {
  const pageUrl = new URL(window.location.href);
  const hashQuery = pageUrl.hash.split("?")[1] ?? "";
  return (
    pageUrl.searchParams.get("token") ??
    new URLSearchParams(hashQuery).get("token") ??
    ""
  );
}

function passwordResetRedirect() {
  const redirect = new URL(import.meta.env.BASE_URL, window.location.origin);
  redirect.hash = "/account";
  return redirect.toString();
}

export function Account() {
  const {
    user,
    status,
    isConfigured,
    signInWithPassword,
    requestPasswordReset,
    resetPassword,
    signOut,
  } = useAuth();
  const {
    state,
    librarySync,
    startCloudSync,
    retryCloudSync,
    downloadExport,
    deleteAllData,
  } = useStore();
  const [resetToken] = useState(readResetToken);
  const [mode, setMode] = useState<AccountMode>(
    resetToken ? "reset-password" : "sign-in",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const libraryCount = Object.keys(state.userMedia).length;
  const runDelete = async () => {
    setDeleting(true);
    try {
      await deleteAllData();
      setConfirmText("");
    } finally {
      setDeleting(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const result = await signInWithPassword(email, password);
    setSubmitting(false);
    setMessage(result.error ?? null);
  };

  const sendPasswordReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const result = await requestPasswordReset(email, passwordResetRedirect());
    setSubmitting(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMode("reset-sent");
  };

  const setNewPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    if (password !== confirmPassword) {
      setMessage("The passwords do not match.");
      return;
    }

    setSubmitting(true);
    const result = await resetPassword(password, resetToken);
    setSubmitting(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }

    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("token");
    cleanUrl.hash = "/account";
    window.history.replaceState(null, "", cleanUrl);
    setPassword("");
    setConfirmPassword("");
    setMode("sign-in");
    setMessage("Password set. You can sign in now.");
  };

  const handleSignOut = async () => {
    setSubmitting(true);
    const result = await signOut();
    setSubmitting(false);
    if (result.error) setMessage(result.error);
  };

  return (
    <div className="page account-page">
      <Link className="account-back" to="/">
        <ArrowLeft size={16} /> Back to MovieTracker
      </Link>

      <section className="account-shell">
        <div className="account-intro">
          <p className="eyebrow">ACCOUNT & DATA</p>
          <h1>
            Your stories,
            <br />
            wherever you watch.
          </h1>
          <p>
            Secure accounts and cross-device libraries are the first foundation
            of the invite-only beta.
          </p>
          <ul>
            <li>
              <Database size={17} /> Private cloud library
            </li>
            <li>
              <ShieldCheck size={17} /> Row-level data protection
            </li>
            <li>
              <Check size={17} /> Managed account security
            </li>
          </ul>
        </div>

        <div className="account-card">
          {!isConfigured ? (
            <div className="account-demo-state">
              <span className="account-state-icon">
                <Database size={23} />
              </span>
              <p className="eyebrow">DEMO MODE</p>
              <h2>Cloud accounts are ready to connect.</h2>
              <p>
                This deployment does not have Neon credentials yet. Your current
                library remains safely in this browser only.
              </p>
              <code>VITE_NEON_AUTH_URL</code>
              <code>VITE_NEON_DATA_API_URL</code>
              <p className="account-note">
                Add the production values only after the initial migration and
                RLS policies have been deployed.
              </p>
            </div>
          ) : status === "authenticated" && user ? (
            <div className="account-authenticated">
              <span className="account-state-icon success">
                <Check size={23} />
              </span>
              <p className="eyebrow">SIGNED IN</p>
              <h2>Welcome back.</h2>
              <p>{user.email}</p>
              <div className={`account-sync-panel ${librarySync.status}`}>
                {librarySync.status === "needs-import" ? (
                  <>
                    <strong>Finish setting up your cloud library</strong>
                    <p>
                      Copy {Object.keys(state.userMedia).length} browser titles
                      to this account. The import is deliberate and safe to
                      retry, so viewing history will not be duplicated.
                    </p>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => void startCloudSync()}
                    >
                      <Database size={17} /> Copy library to Neon
                    </button>
                  </>
                ) : librarySync.status === "synced" ? (
                  <>
                    <strong>Cloud library connected</strong>
                    <p>
                      Library changes now follow this account across browsers
                      and devices.
                    </p>
                  </>
                ) : librarySync.status === "saving" ? (
                  <>
                    <strong>Saving your library…</strong>
                    <p>Keep this page open while the first copy finishes.</p>
                  </>
                ) : librarySync.status === "import-error" ? (
                  <>
                    <strong>The library copy stopped early</strong>
                    <p role="alert">
                      {librarySync.message ??
                        "The browser library was not fully copied."}
                    </p>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => void startCloudSync()}
                    >
                      Retry library copy
                    </button>
                  </>
                ) : librarySync.status === "error" ? (
                  <>
                    <strong>Cloud sync needs attention</strong>
                    <p role="alert">
                      {librarySync.message ??
                        "The library could not be connected."}
                    </p>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => void retryCloudSync()}
                    >
                      Try again
                    </button>
                  </>
                ) : (
                  <>
                    <strong>Connecting your library…</strong>
                    <p>Checking this account’s private Neon data.</p>
                  </>
                )}
              </div>
              <button
                className="secondary-button"
                type="button"
                disabled={submitting}
                onClick={handleSignOut}
              >
                <LogOut size={17} /> Sign out
              </button>
            </div>
          ) : mode === "request-reset" ? (
            <form onSubmit={sendPasswordReset}>
              <span className="account-state-icon">
                <KeyRound size={22} />
              </span>
              <p className="eyebrow">PASSWORD SETUP</p>
              <h2>Create your password.</h2>
              <p>
                Enter the email attached to your Neon account. We will send a
                secure link for choosing a password.
              </p>
              <label>
                <span>Email address</span>
                <div>
                  <Mail size={17} />
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
              </label>
              <button
                className="primary-button"
                type="submit"
                disabled={submitting}
              >
                {submitting ? "Sending…" : "Send password link"}
              </button>
              <button
                className="account-text-button"
                type="button"
                onClick={() => {
                  setMessage(null);
                  setMode("sign-in");
                }}
              >
                Back to sign in
              </button>
              {message && (
                <p className="account-message" role="status">
                  {message}
                </p>
              )}
            </form>
          ) : mode === "reset-password" ? (
            <form onSubmit={setNewPassword}>
              <span className="account-state-icon">
                <KeyRound size={22} />
              </span>
              <p className="eyebrow">PASSWORD SETUP</p>
              <h2>Choose your password.</h2>
              <p>
                Use at least eight characters that you do not reuse elsewhere.
              </p>
              <label>
                <span>New password</span>
                <div>
                  <ShieldCheck size={17} />
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="At least 8 characters"
                  />
                </div>
              </label>
              <label>
                <span>Confirm password</span>
                <div>
                  <ShieldCheck size={17} />
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Repeat your password"
                  />
                </div>
              </label>
              <button
                className="primary-button"
                type="submit"
                disabled={submitting}
              >
                {submitting ? "Saving…" : "Set password"}
              </button>
              {message && (
                <p className="account-message" role="status">
                  {message}
                </p>
              )}
            </form>
          ) : mode === "reset-sent" ? (
            <div className="account-authenticated">
              <span className="account-state-icon success">
                <Mail size={22} />
              </span>
              <p className="eyebrow">CHECK YOUR EMAIL</p>
              <h2>Your password link is on its way.</h2>
              <p>
                If that address belongs to an account, Neon will send a secure
                setup link. Check your spam folder if it does not arrive.
              </p>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setMode("sign-in")}
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={submit}>
              <p className="eyebrow">INVITE-ONLY BETA</p>
              <h2>Sign in to your invited account.</h2>
              <p>
                Beta accounts are provisioned privately. Public registration is
                not available.
              </p>
              <label>
                <span>Email address</span>
                <div>
                  <Mail size={17} />
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
              </label>
              <label>
                <span>Password</span>
                <div>
                  <ShieldCheck size={17} />
                  <input
                    type="password"
                    autoComplete="current-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Your password"
                  />
                </div>
              </label>
              <button
                className="primary-button"
                type="submit"
                disabled={submitting || status === "loading"}
              >
                {submitting ? "Signing in…" : "Sign in"}
              </button>
              <button
                className="account-text-button"
                type="button"
                onClick={() => {
                  setMessage(null);
                  setPassword("");
                  setMode("request-reset");
                }}
              >
                Set or reset password
              </button>
              {message && (
                <p className="account-message" role="status">
                  {message}
                </p>
              )}
            </form>
          )}
        </div>

        <section className="account-card account-data-controls">
          <p className="eyebrow">YOUR DATA</p>
          <h2>Export or delete your library</h2>
          <p className="account-note">
            Download a personal backup of your library, or permanently delete
            your data from this device and account. Your sign-in is not removed.
          </p>

          <button
            type="button"
            className="secondary-button"
            onClick={downloadExport}
          >
            Export my data
          </button>

          <div className="account-danger-zone">
            <label htmlFor="account-delete-confirm" className="account-note">
              Type DELETE to confirm
            </label>
            <input
              id="account-delete-confirm"
              className="account-input"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              autoComplete="off"
            />
            <button
              type="button"
              className="secondary-button danger"
              disabled={confirmText !== "DELETE" || deleting}
              onClick={() => void runDelete()}
            >
              Delete all my data
            </button>
            {libraryCount === 0 ? (
              <p className="account-message" role="status">
                Your library is empty.
              </p>
            ) : null}
          </div>
        </section>
      </section>
    </div>
  );
}
