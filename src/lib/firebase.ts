import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { firebaseConfig, firebaseEnabled } from './firebaseConfig';

// Initialize Firebase only when the config has been filled in. We rely on the
// backend session (not Firebase persistence) after verification, so in-memory
// auth is fine here — the phone number is verified, exchanged for a Blink
// token, and Firebase's own session is disposable.
export const firebaseApp = firebaseEnabled
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;

export { firebaseConfig, firebaseEnabled };
