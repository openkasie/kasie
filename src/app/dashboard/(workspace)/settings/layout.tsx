import { SettingsPageHeader } from "./components/SettingsPageHeader";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <SettingsPageHeader />
      {children}
    </div>
  );
}
