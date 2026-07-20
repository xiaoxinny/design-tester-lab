import type { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <header className="mb-6 text-center font-mono text-xl font-semibold text-text-primary">
          design-tester-lab
        </header>
        {children}
      </div>
    </main>
  );
}
