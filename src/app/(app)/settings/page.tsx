'use client';

import { useState, type FormEvent } from 'react';

import { toast } from '@/lib/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const MIN_PASSWORD_LENGTH = 8;

export default function SettingsPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        variant: 'error',
        title: 'New passwords do not match',
        description: 'Type the new password twice, the same way both times.',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (response.ok) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        toast({ variant: 'success', title: 'Password updated' });
        return;
      }

      const data: { error?: string } = await response.json().catch(() => ({}));
      const msg = data.error || 'Failed to update password';
      toast({ variant: 'error', title: 'Could not update password', description: msg });
    } catch {
      toast({
        variant: 'error',
        title: 'Could not update password',
        description: 'An unexpected error occurred',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 font-mono text-2xl font-semibold">Settings</h1>

      <Card className="p-6">
        <CardHeader>
          <h2 className="font-mono text-lg font-semibold">Change password</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Minimum {MIN_PASSWORD_LENGTH} characters.
          </p>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div>
              <Label className="mb-1 block" htmlFor="current-password">
                Current password
              </Label>
              <Input
                autoComplete="current-password"
                id="current-password"
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
                type="password"
                value={currentPassword}
              />
            </div>

            <div>
              <Label className="mb-1 block" htmlFor="new-password">
                New password
              </Label>
              <Input
                autoComplete="new-password"
                id="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                type="password"
                value={newPassword}
              />
            </div>

            <div>
              <Label className="mb-1 block" htmlFor="confirm-password">
                Confirm new password
              </Label>
              <Input
                autoComplete="new-password"
                id="confirm-password"
                minLength={MIN_PASSWORD_LENGTH}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                type="password"
                value={confirmPassword}
              />
            </div>

            <Button disabled={loading} type="submit" variant="primary">
              {loading ? 'Updating...' : 'Update password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
