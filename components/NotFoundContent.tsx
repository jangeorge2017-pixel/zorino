import Link from "next/link";
import Button from "@/components/ui/Button";
import { PageLayout } from "@/components/pages";
import { Home, Search } from "lucide-react";

export default function NotFoundContent() {
  return (
    <PageLayout>
      <div className="zor-page-state zor-page-state--404 min-h-[60vh]">
        <p className="zor-page-state__code">404</p>
        <h1 className="zor-page-state__title text-3xl">Page Not Found</h1>
        <p className="zor-page-state__text mb-8">
          The page you&apos;re looking for doesn&apos;t exist or may have been moved.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link href="/">
            <Button className="flex items-center gap-2">
              <Home className="w-4 h-4" />
              Go Home
            </Button>
          </Link>
          <Link href="/search">
            <Button variant="outline" className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              Search Deals
            </Button>
          </Link>
        </div>
      </div>
    </PageLayout>
  );
}
