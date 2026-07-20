import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="text-center">
        <h1 className="font-mono text-display font-bold text-text-muted">404</h1>
        <p className="mt-4 text-lg text-text-secondary">
          Page not found
        </p>
        <p className="mt-2 text-sm text-text-muted">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:brightness-110"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
