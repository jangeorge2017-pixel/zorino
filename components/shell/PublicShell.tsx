import SiteFooter from "@/components/shell/SiteFooter";
import SiteNav from "@/components/shell/SiteNav";

type PublicShellProps = {
  children: React.ReactNode;
};

export default function PublicShell({ children }: PublicShellProps) {
  return (
    <div className="zor-public-shell">
      <SiteNav />
      <main className="zor-public-shell__main">{children}</main>
      <SiteFooter />
    </div>
  );
}
