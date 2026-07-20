'use client';

import { useState, type FormEvent } from 'react';

import { toast } from '@/lib/use-toast';
import { AnimateIn } from '@/components/ui/animate-in';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        window.location.href = '/';
        return;
      }

      const data: { error?: string } = await response.json();
      const msg = data.error || 'Signup failed';
      setError(msg);
      toast({ variant: 'error', title: 'Signup failed', description: msg });
    } catch {
      setError('Signup failed');
      toast({ variant: 'error', title: 'Signup failed', description: 'An unexpected error occurred' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimateIn>
    <Card className="p-6">
      <CardHeader>
        <h1 className="font-mono text-lg font-semibold">Create account</h1>
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
              autoComplete="new-password"
              id="password"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </div>

          <div>
            <Label className="mb-1 block" htmlFor="confirm-password">
              Confirm password
            </Label>
            <Input
              autoComplete="new-password"
              id="confirm-password"
              minLength={8}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              type="password"
              value={confirmPassword}
            />
          </div>

          {error && (
            <p aria-live="polite" className="text-sm text-danger">
              {error}
            </p>
          )}

          <Button className="w-full" disabled={loading} type="submit" variant="primary">
            {loading ? 'Creating account...' : 'Create account'}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-text-secondary">
          Already have an account?{' '}
          <a className="text-accent hover:underline" href="/login">
            Log in
          </a>
        </p>
      </CardContent>
    </Card>
    </AnimateIn>
  );
}
