import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';

export const userDoc = (uid) => doc(db, 'users', uid);
export const col = (uid, name) => collection(db, 'users', uid, name);
export const docRef = (uid, name, id) => doc(db, 'users', uid, name, id);

// Log de alterações (quem alterou o quê e quando)
export const logActivity = (uid, action, entity, label, detail = '') => {
  // fire-and-forget: o log nunca deve bloquear a operação principal
  addDoc(col(uid, 'activityLog'), {
    action,
    entity,
    label: label || '',
    detail: detail || '',
    at: serverTimestamp(),
  }).catch(() => {});
};

// API de CRUD com log automático, vinculada ao uid logado
export const makeApi = (uid) => ({
  uid,
  batch: () => writeBatch(db),
  ref: (name, id) => docRef(uid, name, id),
  col: (name) => col(uid, name),

  async add(name, data, label) {
    const ref = await addDoc(col(uid, name), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    logActivity(uid, 'criou', name, label ?? data.name ?? ref.id);
    return ref;
  },

  async update(name, id, data, label) {
    await updateDoc(docRef(uid, name, id), { ...data, updatedAt: serverTimestamp() });
    logActivity(uid, 'editou', name, label ?? data.name ?? id);
  },

  async remove(name, id, label) {
    await deleteDoc(docRef(uid, name, id));
    logActivity(uid, 'excluiu', name, label ?? id);
  },

  async setSettings(data) {
    await setDoc(userDoc(uid), { ...data, updatedAt: serverTimestamp() }, { merge: true });
    logActivity(uid, 'editou', 'configuracoes', 'Configurações');
  },
});
