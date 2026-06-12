import { getDoc, serverTimestamp, setDoc, writeBatch, doc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { userDoc } from './db';
import { DEFAULT_MATERIALS, DEFAULT_SETTINGS } from './constants';

// No primeiro login: cria o documento de configurações e semeia a
// biblioteca de materiais com os principais filamentos do mercado.
export const ensureSeed = async (uid) => {
  const snap = await getDoc(userDoc(uid));
  if (snap.exists() && snap.data().seeded) return;

  await setDoc(
    userDoc(uid),
    { ...DEFAULT_SETTINGS, seeded: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
    { merge: true }
  );

  const batch = writeBatch(db);
  for (const m of DEFAULT_MATERIALS) {
    const ref = doc(collection(db, 'users', uid, 'materials'));
    batch.set(ref, { ...m, builtin: true, createdAt: serverTimestamp() });
  }
  await batch.commit();
};
