// ---------------------------------------------------------------------------
// Paste your Firebase project's web config here. You get this from:
// Firebase Console -> Project settings (gear icon) -> General -> Your apps
// -> Web app -> SDK setup and configuration -> "Config" option.
// It looks like the object below, just with real values instead of the
// placeholders. This config is safe to publish publicly (it is not a
// secret), the real protection is in firestore.rules.
// ---------------------------------------------------------------------------
export const firebaseConfig = {
  apiKey: "AIzaSyCoNTK_VLy3kTO3UqMt34ghmxoRBss8E3E",
  authDomain: "creator-fest-2026-voting.firebaseapp.com",
  projectId: "creator-fest-2026-voting",
  storageBucket: "creator-fest-2026-voting.firebasestorage.app",
  messagingSenderId: "862586200468",
  appId: "1:862586200468:web:805b36f0b0c02411deaf81",
};

// ---------------------------------------------------------------------------
// Set your own admin code here. This must match the value inside
// firestore.rules (the ADMIN_CODE constant there) exactly, or admin actions
// will be rejected. Keep this file out of public view if you don't want
// people reading the admin code from the page source, although the real
// enforcement happens in firestore.rules, not here.
// ---------------------------------------------------------------------------
export const ADMIN_CODE = "CF2026ADMIN";
