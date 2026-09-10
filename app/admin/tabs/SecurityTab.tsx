// app/admin/tabs/SecurityTab.tsx
// The "Security" admin tab -- backup codes, authenticator QR re-display,
// log-out-everywhere, recent login attempts. Split out of
// app/admin/page.tsx (#16). loginAttempts + backupCodesRemaining come from
// the shared loadAll() via AdminDataContext; everything else here is
// tab-local. Behaviour is unchanged from the old inline block.
"use client";
import { useState } from "react";
import { apiRequest } from "@/app/admin/lib/apiRequest";
import { useAdminData } from "@/app/admin/AdminDataContext";

export default function SecurityTab() {
  const { loginAttempts, backupCodesRemaining, setBackupCodesRemaining } = useAdminData();

  const [newBackupCodes, setNewBackupCodes] = useState<string[] | null>(null);
  const [backupCodesStatus, setBackupCodesStatus] = useState("");
  const [logoutEverywhereStatus, setLogoutEverywhereStatus] = useState("");
  const [totpQr, setTotpQr] = useState<{ secret: string; qrSvg: string } | null>(null);
  const [totpQrStatus, setTotpQrStatus] = useState("");

  const handleGenerateBackupCodes = async () => {
    if (backupCodesRemaining !== null && backupCodesRemaining > 0) {
      const confirmed = window.confirm(`This invalidates your ${backupCodesRemaining} existing unused backup code(s). Continue?`);
      if (!confirmed) return;
    }
    setBackupCodesStatus("Generating...");
    try {
      const result = await apiRequest("/api/admin/backup-codes", { method: "POST" });
      setNewBackupCodes(result.codes);
      setBackupCodesRemaining(result.codes.length);
      setBackupCodesStatus("");
    } catch (err: unknown) {
      setBackupCodesStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Re-renders a QR code for the *existing* ADMIN_TOTP_SECRET on demand --
  // doesn't rotate or change anything server-side, just gives a scan-to-add
  // path for a new phone/authenticator app instead of copying the raw
  // secret out of Vercel's dashboard.
  const handleShowTotpQr = async () => {
    setTotpQrStatus("Loading...");
    try {
      const result = await apiRequest("/api/admin/totp-qr");
      setTotpQr({ secret: result.secret, qrSvg: result.qrSvg });
      setTotpQrStatus("");
    } catch (err: unknown) {
      setTotpQrStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleLogoutEverywhere = async () => {
    if (!window.confirm("This immediately logs out every active admin session, including this one. Continue?")) return;
    setLogoutEverywhereStatus("Logging out everywhere...");
    try {
      await apiRequest("/api/admin/sessions", { method: "DELETE" });
      window.location.href = "/admin/login";
    } catch (err: unknown) {
      setLogoutEverywhereStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <>
    {/* SECTION F: ADMIN LOGIN SECURITY -- backup codes, active sessions, attempt log */}
    <div className="bg-surface border border-border rounded-lg shadow-sm p-8 space-y-10">
      <div className="border-b border-border pb-4">
        <h2 className="text-xl font-serif text-fg">Security</h2>
        <p className="text-faint text-xs mt-1">Backup codes, active sessions, and recent activity for the admin login.</p>
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-wider font-semibold text-muted mb-2">Backup Codes</h3>
        <p className="text-faint text-xs mb-3">
          Use a backup code in place of an authenticator code if you lose access to your authenticator app. Generating a new
          batch invalidates every existing code, used or not.
        </p>
        <p className="text-sm text-muted mb-3">
          {backupCodesRemaining === null ? "Loading..." : `${backupCodesRemaining} unused backup code${backupCodesRemaining === 1 ? "" : "s"} remaining.`}
        </p>
        <button
          type="button"
          onClick={handleGenerateBackupCodes}
          className="px-4 py-2 text-xs uppercase tracking-wider font-semibold border border-border-strong rounded text-muted hover:bg-surface-2 hover:text-fg transition"
        >
          Generate New Backup Codes
        </button>
        {backupCodesStatus && <p className="text-xs text-danger mt-2">{backupCodesStatus}</p>}

        {newBackupCodes && (
          <div className="mt-4 border border-accent-soft-border bg-accent-soft rounded-lg p-4">
            <p className="text-xs font-semibold text-accent mb-2">Save these now &mdash; they won&rsquo;t be shown again:</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-sm text-fg mb-3">
              {newBackupCodes.map((c) => (
                <div key={c} className="bg-surface border border-border rounded px-2 py-1.5 text-center">
                  {c}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setNewBackupCodes(null)}
              className="px-3 py-1.5 text-[11px] uppercase font-semibold border border-accent-soft-border rounded text-accent hover:bg-accent-soft transition"
            >
              I&rsquo;ve saved these
            </button>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-wider font-semibold text-muted mb-2">Authenticator App Setup</h3>
        <p className="text-faint text-xs mb-3">
          Lost access to your authenticator (new phone, reinstalled app)? This re-displays a QR code for the same
          secret it was originally set up with &mdash; scanning it adds a working entry to a new device without
          changing anything here. Doesn&rsquo;t rotate the secret, so any authenticator still holding the old entry
          keeps working too.
        </p>
        {!totpQr ? (
          <button
            type="button"
            onClick={handleShowTotpQr}
            disabled={totpQrStatus === "Loading..."}
            className="px-4 py-2 text-xs uppercase tracking-wider font-semibold border border-border-strong rounded text-muted hover:bg-surface-2 hover:text-fg transition disabled:opacity-50"
          >
            {totpQrStatus === "Loading..." ? "Loading..." : "Show Setup QR Code"}
          </button>
        ) : (
          <div className="border border-border bg-surface-2 rounded-lg p-4 max-w-xs">
            <div
              className="bg-surface rounded p-2 w-40 h-40 mx-auto"
              dangerouslySetInnerHTML={{ __html: totpQr.qrSvg }}
            />
            <p className="text-[11px] text-faint mt-3 mb-1">Can&rsquo;t scan? Enter this setup key manually:</p>
            <p className="font-mono text-xs bg-surface border border-border rounded px-2 py-1.5 text-center break-all text-fg">
              {totpQr.secret}
            </p>
            <button
              type="button"
              onClick={() => setTotpQr(null)}
              className="mt-3 w-full px-3 py-1.5 text-[11px] uppercase font-semibold border border-border-strong rounded text-muted hover:bg-surface-2 transition"
            >
              Hide
            </button>
          </div>
        )}
        {totpQrStatus && totpQrStatus !== "Loading..." && <p className="text-xs text-danger mt-2">{totpQrStatus}</p>}
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-wider font-semibold text-muted mb-2">Active Sessions</h3>
        <p className="text-faint text-xs mb-3">
          If a device holding an admin session may have been compromised, log out everywhere &mdash; this immediately
          invalidates every session, including this one.
        </p>
        <button
          type="button"
          onClick={handleLogoutEverywhere}
          className="px-4 py-2 text-xs uppercase tracking-wider font-semibold border border-danger-border rounded text-danger hover:bg-danger-soft transition"
        >
          Log Out Everywhere
        </button>
        {logoutEverywhereStatus && <p className="text-xs text-danger mt-2">{logoutEverywhereStatus}</p>}
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-wider font-semibold text-muted mb-2">Recent Login Attempts</h3>
        {loginAttempts.length === 0 ? (
          <p className="text-faint text-sm">No login attempts recorded yet.</p>
        ) : (
          <div className="divide-y divide-border text-xs">
            {loginAttempts.map((a) => (
              <div key={a.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-faint">{new Date(a.created_at).toLocaleString()}</span>
                <span className="font-mono text-muted">{a.ip}</span>
                <span
                  className={`uppercase font-semibold px-2 py-0.5 rounded ${
                    a.success ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
                  }`}
                >
                  {a.success ? "Success" : String(a.reason).replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  );
}
