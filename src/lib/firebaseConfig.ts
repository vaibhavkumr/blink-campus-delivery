// ── Firebase web config ───────────────────────────────────────────────
// Paste the config object from the Firebase console here:
//   Firebase console → Project settings (gear) → General → "Your apps" →
//   your Web app → "SDK setup and configuration" → Config.
//
// These values are NOT secret — they identify your project to Firebase and
// are meant to ship in the client. (The private service-account key is a
// different thing and lives only on the server, in server/.env.)
//
// While apiKey is blank, the app automatically falls back to the existing
// dev-code / Twilio verification, so nothing breaks before you fill this in.
export const firebaseConfig = {
  apiKey: '',
  authDomain: '', // e.g. blink-xxxxx.firebaseapp.com
  projectId: '', // e.g. blink-xxxxx
  storageBucket: '', // e.g. blink-xxxxx.appspot.com
  messagingSenderId: '',
  appId: '',
};

// Firebase phone auth turns on only once a real apiKey + projectId are present.
export const firebaseEnabled =
  firebaseConfig.apiKey.length > 0 && firebaseConfig.projectId.length > 0;
