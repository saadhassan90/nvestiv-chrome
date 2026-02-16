import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest((env) => {
  const isDev = env.mode === 'development';

  return {
    manifest_version: 3,
    name: 'Nvestiv Intelligence',
    version: '1.0.0',
    description: 'AI-powered intelligence for alternative investment professionals',

    permissions: [
      'storage',
      'sidePanel',
      'tabs',
      'notifications',
      'alarms',
    ],

    host_permissions: [
      'https://*.linkedin.com/*',
      'https://api.nvestiv.com/*',
      'https://reports.nvestiv.com/*',
      ...(isDev ? ['http://localhost:3001/*'] : []),
    ],

    // Required for auth flow: allows app.nvestiv.com to send
    // AUTH_SUCCESS message to the extension via chrome.runtime.sendMessage
    externally_connectable: {
      matches: [
        'https://app.nvestiv.com/*',
        ...(isDev ? ['http://localhost:5173/*'] : []),
      ],
    },

    background: {
      service_worker: 'src/background/index.ts',
      type: 'module' as const,
    },

    content_scripts: [
      {
        matches: ['https://*.linkedin.com/*'],
        js: ['src/content/index.ts'],
        run_at: 'document_idle' as const,
      },
    ],

    side_panel: {
      default_path: 'src/sidepanel/sidepanel.html',
    },

    action: {
      default_title: 'Nvestiv Intelligence',
      default_icon: {
        '16': 'src/assets/icons/icon16.png',
        '32': 'src/assets/icons/icon32.png',
        '48': 'src/assets/icons/icon48.png',
        '128': 'src/assets/icons/icon128.png',
      },
    },

    icons: {
      '16': 'src/assets/icons/icon16.png',
      '32': 'src/assets/icons/icon32.png',
      '48': 'src/assets/icons/icon48.png',
      '128': 'src/assets/icons/icon128.png',
    },
  };
});
