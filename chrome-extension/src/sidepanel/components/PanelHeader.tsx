import { useSidePanelStore } from '../store';
import { NvestivLogomark } from './NvestivLogo';
import { Button } from './ui/button';
import { Settings, ArrowLeft } from 'lucide-react';

export function PanelHeader() {
  const auth = useSidePanelStore((s) => s.auth);
  const view = useSidePanelStore((s) => s.view);
  const navigateToSettings = useSidePanelStore((s) => s.navigateToSettings);
  const navigateBack = useSidePanelStore((s) => s.navigateBack);

  const isSettings = view === 'settings';

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-10">
      <div className="flex items-center gap-2.5">
        {isSettings ? (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={navigateBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        ) : (
          <NvestivLogomark className="h-6 w-6" />
        )}
        <span className="text-sm font-semibold tracking-tight">
          {isSettings ? 'Settings' : 'Nvestiv Intelligence'}
        </span>
      </div>
      {auth && !isSettings && (
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={navigateToSettings}>
          <Settings className="h-4 w-4" />
        </Button>
      )}
    </header>
  );
}
