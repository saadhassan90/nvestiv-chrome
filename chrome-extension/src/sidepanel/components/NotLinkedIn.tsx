import { Button } from './ui/button';
import { NvestivLogomark } from './NvestivLogo';
import { ExternalLink } from 'lucide-react';

export function NotLinkedIn() {
  const handleGoToLinkedIn = () => {
    chrome.tabs.create({ url: 'https://www.linkedin.com' });
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-8 py-16 text-center animate-fade-in">
      {/* Icon */}
      <div className="w-14 h-14 rounded-2xl bg-brand-light flex items-center justify-center mb-5">
        <NvestivLogomark className="h-7 w-7" />
      </div>

      <h2 className="text-base font-semibold mb-2">Navigate to LinkedIn</h2>
      <p className="text-sm text-muted-foreground mb-8 max-w-[280px] leading-relaxed">
        Visit a LinkedIn profile or company page to start gathering intelligence.
      </p>

      <Button onClick={handleGoToLinkedIn} className="w-full max-w-[240px]">
        <ExternalLink className="h-4 w-4" />
        Go to LinkedIn
      </Button>
    </div>
  );
}
