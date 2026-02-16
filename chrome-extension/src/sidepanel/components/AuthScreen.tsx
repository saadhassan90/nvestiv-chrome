import { Button } from './ui/button';
import { NvestivLogo } from './NvestivLogo';
import { LogIn } from 'lucide-react';

export function AuthScreen() {
  const handleSignIn = () => {
    chrome.runtime.sendMessage({ type: 'SIGN_IN', data: {} });
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-8 py-16 animate-fade-in">
      {/* Logo */}
      <div className="mb-8">
        <NvestivLogo className="h-8" />
      </div>

      {/* Tagline */}
      <p className="text-sm text-muted-foreground text-center mb-10 max-w-[280px] leading-relaxed">
        AI-powered research for alternative investment professionals
      </p>

      {/* Sign in button */}
      <Button onClick={handleSignIn} className="w-full max-w-[260px] h-11 text-sm font-medium">
        <LogIn className="h-4 w-4" />
        Sign in to continue
      </Button>

      {/* Create account link */}
      <p className="text-xs text-muted-foreground mt-5">
        Don&apos;t have an account?{' '}
        <a
          href="https://app.nvestiv.com/signup"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary font-medium hover:underline underline-offset-2"
        >
          Create one
        </a>
      </p>
    </div>
  );
}
