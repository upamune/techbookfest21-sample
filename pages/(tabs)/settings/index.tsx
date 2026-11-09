import { AppBar } from "@pocket/ui/app-bar";
import { AccountSettings } from "@/account/auth-gate";

export default function SettingsPage() {
  return (
    <>
      <AppBar title="設定" />
      <main className="page settings">
        <AccountSettings />
      </main>
    </>
  );
}
