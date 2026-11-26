// Shared helpers used by both the attendee voting page and the admin page.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  collection,
  writeBatch,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { firebaseConfig } from "../firebase-config.js";

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  collection,
  writeBatch,
  serverTimestamp,
};

// Resolves once an anonymous Firebase session is ready. Anonymous auth is
// free and needs no phone/SMS verification; it just gives Firestore
// security rules something to check (request.auth != null) so random
// unauthenticated scripts can't poke the database directly.
export function ensureSignedIn() {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        unsub();
        resolve(user);
      }
    }, reject);
    signInAnonymously(auth).catch((err) => {
      unsub();
      reject(err);
    });
  });
}

// Normalizes a Malaysian (or generic) phone number into a stable document
// id: strips everything but digits, drops a leading country code "60", and
// drops a leading "0". "012-345 6789", "+60123456789", "60123456789" and
// "0123456789" all become "123456789".
export function normalizePhone(raw) {
  let digits = String(raw || "").replace(/\D/g, "");
  if (digits.startsWith("60") && digits.length > 9) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  return digits;
}

export function isValidPhoneInput(raw) {
  const normalized = normalizePhone(raw);
  return normalized.length >= 7 && normalized.length <= 11;
}

export const COMPETITIONS = [
  { id: "movement", label: "Cre8 Movement", votesCollection: "votes_movement", contestantsCollection: "contestants_movement" },
  { id: "sound", label: "Cre8 Sound", votesCollection: "votes_sound", contestantsCollection: "contestants_sound" },
];

export function competitionById(id) {
  return COMPETITIONS.find((c) => c.id === id);
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}
