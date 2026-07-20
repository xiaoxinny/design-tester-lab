'use client';

import { useState, type FormEvent } from 'react';

import { toast } from '@/lib/use-toast';
import { AnimateIn } from '@/components/ui/animate-in';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        window.location.href = '/';
        return;
      }

      const data: { error?: string } = await response.json();
      const msg = data.error || 'Login failed';
      setError(msg);
      toast({ variant: 'error', title: 'Login failed', description: msg });
    } catch {
      setError('Login failed');
      toast({ variant: 'error', title: 'Login failed', description: 'An unexpected error occurred' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimateIn>
    <Card className="p-6">
      <CardHeader>
        <h1 className="font-mono text-lg font-semibold">Log in</h1>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div>
            <Label className="mb-1 block" htmlFor="email">
              Email
            </Label>
            <Input
              autoComplete="email"
              id="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </div>

          <div>
            <Label className="mb-1 block" htmlFor="password">
              Password
            </Label>
            <Input
              autoComplete="current-password"
              id="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </div>

          {error && (
            <p aria-live="polite" className="text-sm text-danger">
              {error}
            </p>
          )}

          <Button className="w-full" disabled={loading} type="submit" variant="primary">
            {loading ? 'Logging in...' : 'Log in'}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-text-secondary">
          Don&apos;t have an account?{' '}
          <a className="text-accent hover:underline" href="/signup">
            Sign up
          </a>
        </p>
      </CardContent>
    </Card>
    </AnimateIn>
  );
}
