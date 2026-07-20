'use client';

import { useCallback, useState } from 'react';

export function LogoutButton() {
  const [pending, setPending] = useState(false);

  const handleLogout = useCallback(async () => {
    setPending(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Even if the request fails, redirect to login
    }
    window.location.href = '/login';
  }, []);

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={pending}
      className="text-sm text-text-muted transition-colors hover:text-danger disabled:opacity-50"
    >
      {pending ? 'Logging out...' : 'Log out'}
    </button>
  );
}
