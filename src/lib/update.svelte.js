// Mise à jour à distance : au lancement (puis toutes les heures), l'application lit version.json dans la
// dernière Release GitHub. Si seule la partie web a changé, elle télécharge le nouveau paquet en arrière-plan
// et l'applique au prochain lancement (ou tout de suite si on le demande). Si la partie Android a changé,
// elle propose de télécharger le nouvel APK.
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

const LATEST = 'https://github.com/clementsellier/BACUS/releases/latest/download/version.json';
const EVERY_MS = 3600_000;

export const BUILD = __BUILD__;

export const update = $state({
  state: 'idle', // idle | ready (paquet téléchargé) | apk (nouvel APK à installer)
  version: null,
  apk: null,
  bundle: null,
  native: null, // version de l'APK installé
});

let busy = false;
let lastCheck = 0;

async function check() {
  if (busy || update.state !== 'idle') return;
  busy = true;
  lastCheck = Date.now();
  try {
    const r = await fetch(LATEST, { cache: 'no-store' });
    if (!r.ok) return;
    const v = await r.json();
    const { native } = await CapacitorUpdater.current();
    update.native = native;
    const level = parseInt(String(native).split('.')[0], 10) || 0;
    if (v.nativeLevel > level) {
      Object.assign(update, { state: 'apk', apk: v.apk, version: v.version });
      return;
    }
    if (!(v.build > BUILD)) return;
    // Paquet déjà téléchargé lors d'un lancement précédent ?
    const { bundles } = await CapacitorUpdater.list();
    let b = bundles.find((x) => x.version === String(v.build) && (x.status === 'success' || x.status === 'pending'));
    if (!b) b = await CapacitorUpdater.download({ url: v.web, version: String(v.build) });
    await CapacitorUpdater.next({ id: b.id });
    Object.assign(update, { state: 'ready', bundle: b.id, version: v.version });
  } catch {
    /* pas de réseau ou Release absente : on réessaiera plus tard */
  } finally {
    busy = false;
  }
}

export function startUpdates() {
  if (!Capacitor.isNativePlatform()) return;
  // Indique que cette version démarre correctement ; sinon le module revient à la version précédente.
  CapacitorUpdater.notifyAppReady().catch(() => {});
  CapacitorUpdater.current()
    .then(({ native }) => (update.native = native))
    .catch(() => {});
  setTimeout(check, 3000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastCheck > EVERY_MS) check();
  });
}

/** Applique tout de suite le paquet téléchargé (l'application redémarre). */
export function applyNow() {
  if (update.bundle) CapacitorUpdater.set({ id: update.bundle });
}
