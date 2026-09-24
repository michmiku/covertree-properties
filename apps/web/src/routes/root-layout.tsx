import { Link, Outlet } from 'react-router';
import { Button } from '@/components/ui/button';

export function RootLayout() {
  return (
    <div className="min-h-svh bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/" className="font-heading text-lg font-semibold">
            Covertree properties
          </Link>
          <Button asChild size="sm">
            <Link to="/properties/new">New property</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
