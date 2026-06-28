import { initializeApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

/* ============================================================
   Firebase config — project "loveblock-app"
   ============================================================ */
export const firebaseConfig = {
  apiKey: 'AIzaSyBHIm4R--DDGZGltKonlIsAAr_z9pWRwFg',
  authDomain: 'loveblock-52ae0.firebaseapp.com',
  projectId: 'loveblock-52ae0',
  storageBucket: 'loveblock-52ae0.firebasestorage.app',
  messagingSenderId: '967768508580',
  appId: '1:967768508580:web:d308cec052d6e7aa29be31',
};

export const isConfigured = !String(firebaseConfig.apiKey).includes('PASTE');

const app = initializeApp(firebaseConfig);

// Offline-first: Firestore keeps a local copy in IndexedDB and syncs when back online.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true,
});

const auth = getAuth(app);

// Anonymous auth gates the database. The first launch on each device needs a
// connection once; after that the token is cached and works offline.
let readyPromise = null;
export function ensureReady() {
  if (!readyPromise) {
    readyPromise = new Promise((resolve) => {
      let settled = false;
      const done = (v) => { if (!settled) { settled = true; resolve(v); } };
      onAuthStateChanged(auth, (user) => { if (user) done(user); });
      signInAnonymously(auth).catch((e) => {
        console.error('Anonymous sign-in failed (offline first launch?)', e);
        // Resolve anyway after a moment so a cached session can still load.
        setTimeout(() => done(auth.currentUser || null), 1500);
      });
    });
  }
  return readyPromise;
}
