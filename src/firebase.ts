import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';

// Firebase config via Vite env variables. Set these in .env: VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig as any);
export const auth = getAuth(app);
export const db = getFirestore(app);

export async function signUpWithEmail(email: string, password: string) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signOutUser() {
  return signOut(auth);
}

export { onAuthStateChanged };

// Upload entries array to user's subcollection 'entries'. Each entry uses its timestamp as document ID.
export async function uploadEntriesForUser(user: User, entries: Array<{character:string; skill:number; cpm:number; ts:number}>) {
  if (!user || !user.uid) throw new Error('no user');
  const uid = user.uid;
  const promises = entries.map(e => {
    const docRef = doc(db, 'users', uid, 'entries', String(e.ts));
    return setDoc(docRef, e, { merge: true });
  });
  return Promise.all(promises);
}

// Fetch all entries for a user from Firestore (returns array of entry objects)
export async function fetchEntriesForUser(user: User) {
  if (!user || !user.uid) throw new Error('no user');
  const uid = user.uid;
  const colRef = collection(db, 'users', uid, 'entries');
  const snap = await getDocs(colRef);
  return snap.docs.map(d => d.data() as {character:string; skill:number; cpm:number; ts:number});
}

// Delete a single entry document for a user
export async function deleteEntryForUser(user: User, ts: number) {
  if (!user || !user.uid) throw new Error('no user');
  const uid = user.uid;
  const docRef = doc(db, 'users', uid, 'entries', String(ts));
  return deleteDoc(docRef);
}

// Clear all entries for a user
export async function clearEntriesForUser(user: User) {
  if (!user || !user.uid) throw new Error('no user');
  const uid = user.uid;
  const colRef = collection(db, 'users', uid, 'entries');
  const snap = await getDocs(colRef);
  const promises: Promise<any>[] = [];
  snap.docs.forEach(d => {
    promises.push(deleteDoc(doc(db, 'users', uid, 'entries', d.id)));
  });
  return Promise.all(promises);
}
