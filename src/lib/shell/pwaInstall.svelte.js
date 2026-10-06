// @ts-check
/**
 * Install-Karte auf der Startseite (R08) — ersetzt das alte PWA-Install-Banner
 * aus App.svelte. `dismissed` ist bewusst nicht persistiert (wie vorher
 * `showPwaBanner`): nach Reload darf die Karte wieder erscheinen.
 */
import { get } from 'svelte/store';
import { pwaInstallEvent } from '$lib/stores/app.js';
import { HapticService } from '$lib/services/HapticService.js';

export const pwaInstall = $state({ dismissed: false });

export async function triggerPwaInstall() {
  HapticService.lightTap();
  const e = get(pwaInstallEvent);
  if (!e) return;
  e.prompt();
  await e.userChoice;
  pwaInstallEvent.set(null);
}

export function dismissPwaInstall() {
  HapticService.lightTap();
  pwaInstall.dismissed = true;
}
