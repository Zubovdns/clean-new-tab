import { crx, ManifestV3Export } from '@crxjs/vite-plugin';
import { resolve } from 'path';
import { mergeConfig, defineConfig } from 'vite';

import baseConfig, { baseManifest, baseBuildOptions } from './vite.config.base'

const outDir = resolve(__dirname, 'dist_firefox');

const rawBaseManifest = (baseManifest as unknown) as Record<string, unknown>;
const basePermissions = (rawBaseManifest.permissions as string[]) || [];
const firefoxPermissions = basePermissions.filter((p) => p !== 'favicon');

const baseWar = (rawBaseManifest.web_accessible_resources as Array<{ resources: string[]; matches: string[] }>) || [];
const firefoxWar = baseWar.map((item) => ({
  ...item,
  resources: item.resources.filter((r) => !r.startsWith('_favicon')),
}));

const firefoxManifest = ({
  ...baseManifest,
  permissions: firefoxPermissions,
  web_accessible_resources: firefoxWar,
  browser_specific_settings: {
    gecko: {
      id: 'clean-new-tab@zubovdns.github.io',
      strict_min_version: '109.0',
    },
  },
  background: {
    scripts: ['src/pages/background/index.ts'],
  },
} as unknown) as ManifestV3Export;

export default mergeConfig(
  baseConfig,
  defineConfig({
    plugins: [
      crx({
        manifest: firefoxManifest,
        browser: 'firefox',
        contentScripts: {
          injectCss: true,
        },
      }),
    ],
    build: {
      ...baseBuildOptions,
      outDir
    },
    publicDir: resolve(__dirname, 'public'),
  })
)
