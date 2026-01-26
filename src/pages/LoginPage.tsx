import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InlineMessage } from '@/components/InlineMessage';
import { Bus } from 'lucide-react';

interface LoginPageProps {
  onLogin: (driverId: string, password: string) => void;
  error?: string;
  isLoading?: boolean;
}

export function LoginPage({ onLogin, error, isLoading }: LoginPageProps) {
  const [driverId, setDriverId] = useState('');
  const [password, setPassword] = useState('');

  const isFormValid = driverId.trim() !== '' && password.trim() !== '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormValid && !isLoading) {
      onLogin(driverId, password);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary mb-4">
            <Bus className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Driver App</h1>
          <p className="text-muted-foreground mt-1">Sign in to start your route</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="bg-card rounded-lg border border-border p-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="driverId" className="text-foreground font-medium">
              Driver ID
            </Label>
            <Input
              id="driverId"
              type="text"
              placeholder="Enter your driver ID"
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              className="h-12"
              autoComplete="username"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-foreground font-medium">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <InlineMessage type="error" message={error} />
          )}

          <Button
            type="submit"
            className="w-full h-12 text-base font-semibold"
            disabled={!isFormValid || isLoading}
          >
            {isLoading ? 'Signing in...' : 'LOGIN'}
          </Button>
        </form>
      </div>
    </div>
  );
}
