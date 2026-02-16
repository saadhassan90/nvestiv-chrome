import { useSidePanelStore } from '../store';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { User, Building2, Mail, Link2, LogOut, ExternalLink, ShieldCheck } from 'lucide-react';
import { NvestivLogomark } from './NvestivLogo';

export function SettingsView() {
  const auth = useSidePanelStore((s) => s.auth);

  const handleSignOut = () => {
    chrome.runtime.sendMessage({ type: 'SIGN_OUT', data: {} });
  };

  const handleOpenPrivacy = () => {
    chrome.tabs.create({ url: 'https://report.nvestiv.com/privacy-policy' });
  };

  const handleOpenApp = () => {
    chrome.tabs.create({ url: 'https://app.nvestiv.com' });
  };

  return (
    <div className="flex flex-col gap-3 p-4 animate-slide-up">
      {/* Account */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <User className="h-4 w-4 text-brand" />
            <span className="text-sm font-semibold">Account</span>
          </div>

          <div className="space-y-2.5">
            {auth?.email && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Email</span>
                </div>
                <span className="text-xs font-medium truncate max-w-[180px]">{auth.email}</span>
              </div>
            )}
            {auth?.orgId && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Organization</span>
                </div>
                <Badge variant="secondary" className="text-xs font-normal">{auth.orgId}</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* CRM Integration */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="h-4 w-4 text-brand" />
            <span className="text-sm font-semibold">CRM Integration</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Connection status</span>
            <Badge variant="secondary" className="gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-success" />
              <span className="text-xs">Connected</span>
            </Badge>
          </div>

          <Button variant="outline" size="sm" className="w-full mt-3 h-9" onClick={handleOpenApp}>
            <ExternalLink className="h-3.5 w-3.5" />
            Manage in Nvestiv App
          </Button>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <NvestivLogomark className="h-4 w-4" />
            <span className="text-sm font-semibold">About</span>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Version</span>
              <span className="text-xs font-medium font-mono">1.0.0</span>
            </div>

            <button
              onClick={handleOpenPrivacy}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Privacy Policy
              <ExternalLink className="h-3 w-3 ml-auto" />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Sign out */}
      <Button variant="outline" className="w-full h-10 text-destructive hover:text-destructive hover:bg-destructive/5 mt-1" onClick={handleSignOut}>
        <LogOut className="h-4 w-4" />
        Sign Out
      </Button>
    </div>
  );
}
