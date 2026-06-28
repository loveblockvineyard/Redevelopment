import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

/* Drop-in replacement for the old window.storage helpers.
   Each "key" maps to a document in the `kv` collection holding { value }.
   - reads come from Firestore's local cache when offline
   - writes are fire-and-forget: Firestore queues them and syncs on reconnect,
     so the UI never blocks waiting for the network. */

const ref = (key) => doc(db, 'kv', String(key).replace(/\//g, '_'));

export async function loadJSON(key, fallback) {
  try {
    const snap = await getDoc(ref(key));
    return snap.exists() ? snap.data().value : fallback;
  } catch (e) {
    console.error('loadJSON failed', key, e);
    return fallback;
  }
}

export function saveJSON(key, value) {
  setDoc(ref(key), { value, updatedAt: Date.now() }).catch((e) =>
    console.error('saveJSON failed', key, e)
  );
  return Promise.resolve(true);
}
