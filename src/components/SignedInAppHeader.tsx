import type { Ref } from "react";

type SignedInAppHeaderProps = {
  email: string | null;
  accountSettingsTriggerRef?: Ref<HTMLButtonElement>;
  onOpenAccountSettings: () => void;
  onLogout: () => void;
};

function AccountIcon() {
  return (
    <svg
      aria-hidden="true"
      className="session-action-icon"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="8" r="3" />
      <path d="M5.5 20c.6-4 2.8-6 6.5-6s5.9 2 6.5 6" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      aria-hidden="true"
      className="session-action-icon"
      viewBox="0 0 24 24"
    >
      <path d="M13 5h5v14h-5" />
      <path d="M15 12H4" />
      <path d="m8 8-4 4 4 4" />
    </svg>
  );
}

export default function SignedInAppHeader({
  email,
  accountSettingsTriggerRef,
  onOpenAccountSettings,
  onLogout,
}: SignedInAppHeaderProps) {
  return (
    <header className="session-controls">
      <p className="session-user">
        <img
          className="session-brand"
          src="/brand/marathoner-icon-128.png"
          alt="Marathoner"
          width="32"
          height="32"
        />
        <span className="session-email">
          Signed in as {email ?? "Marathoner user"}
        </span>
      </p>
      <nav className="session-actions" aria-label="Account actions">
        <button
          ref={accountSettingsTriggerRef}
          type="button"
          className="account-settings-btn"
          aria-label="Account settings"
          onClick={onOpenAccountSettings}
        >
          <AccountIcon />
          <span className="session-action-label">Account settings</span>
        </button>
        <button
          type="button"
          className="logout-btn"
          aria-label="Log out"
          onClick={onLogout}
        >
          <LogoutIcon />
          <span className="session-action-label">Log out</span>
        </button>
      </nav>
    </header>
  );
}
