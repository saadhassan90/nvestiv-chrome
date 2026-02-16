import { useEffect } from 'react';
import { useSidePanelStore } from './store';
import { PanelHeader } from './components/PanelHeader';
import { AuthScreen } from './components/AuthScreen';
import { LoadingScreen } from './components/LoadingScreen';
import { NotLinkedIn } from './components/NotLinkedIn';
import { ExistingContactView } from './components/ExistingContactView';
import { NewContactView } from './components/NewContactView';
import { GeneratingView } from './components/GeneratingView';
import { ReportSuccessView } from './components/ReportSuccessView';
import { SettingsView } from './components/SettingsView';
import { ErrorBanner } from './components/ErrorBanner';
import type { ExtensionMessage } from '../shared/types';

function App() {
  const view = useSidePanelStore((s) => s.view);
  const handleMessage = useSidePanelStore((s) => s.handleMessage);
  const setAuth = useSidePanelStore((s) => s.setAuth);

  // Listen for messages from background
  useEffect(() => {
    const listener = (message: ExtensionMessage) => {
      console.log('[sidepanel] received:', message.type);
      handleMessage(message);
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [handleMessage]);

  // Check for existing auth on mount
  useEffect(() => {
    chrome.storage.local
      .get(['auth_token', 'token_expires', 'user_id', 'org_id', 'email'])
      .then((result: Record<string, unknown>) => {
        const token = result.auth_token as string | undefined;
        if (token) {
          const expires = result.token_expires as number | undefined;
          if (expires && Date.now() > expires) {
            setAuth(null);
            return;
          }
          setAuth({
            token,
            userId: result.user_id as string,
            orgId: result.org_id as string,
            email: result.email as string,
            expiresAt: (result.token_expires as number) ?? 0,
          });
        } else {
          setAuth(null);
        }
      });
  }, [setAuth]);

  const renderView = () => {
    switch (view) {
      case 'unauthenticated':
        return <AuthScreen />;
      case 'loading':
        return <LoadingScreen />;
      case 'not_linkedin':
        return <NotLinkedIn />;
      case 'existing_contact':
        return <ExistingContactView />;
      case 'new_contact':
        return <NewContactView />;
      case 'generating':
        return <GeneratingView />;
      case 'report_success':
        return <ReportSuccessView />;
      case 'settings':
        return <SettingsView />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <PanelHeader />
      <ErrorBanner />
      <main className="flex-1 flex flex-col overflow-y-auto">
        {renderView()}
      </main>
    </div>
  );
}

export default App;
