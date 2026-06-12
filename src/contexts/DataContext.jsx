import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { col, makeApi, userDoc } from '../lib/db';
import { useAuth } from './AuthContext';
import { DEFAULT_BRANDS, DEFAULT_SETTINGS } from '../lib/constants';

// Assina TODAS as coleções do usuário em tempo real.
// Volume de dados de uma operação pessoal é pequeno — manter tudo em memória
// simplifica dashboard, busca global e alertas cruzados, sem precisar de
// índices compostos no Firestore.
const COLLECTIONS = [
  'printers',
  'spools',
  'projects',
  'clients',
  'orders',
  'transactions',
  'maintenanceRecords',
  'maintenanceParts',
  'profiles',
  'materials',
  'suppliers',
  'templates',
  'packagingItems',
];

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const { user } = useAuth();
  const uid = user?.uid;

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [data, setData] = useState({});
  const [activity, setActivity] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!uid) {
      setData({});
      setActivity([]);
      setReady(false);
      return;
    }

    const unsubs = [];
    const loaded = new Set();
    const done = (key) => {
      loaded.add(key);
      if (loaded.size >= COLLECTIONS.length + 1) setReady(true);
    };

    unsubs.push(
      onSnapshot(userDoc(uid), (snap) => {
        if (snap.exists()) setSettings({ ...DEFAULT_SETTINGS, ...snap.data() });
        done('settings');
      })
    );

    for (const name of COLLECTIONS) {
      unsubs.push(
        onSnapshot(col(uid, name), (snap) => {
          const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setData((prev) => ({ ...prev, [name]: docs }));
          done(name);
        })
      );
    }

    unsubs.push(
      onSnapshot(query(col(uid, 'activityLog'), orderBy('at', 'desc'), limit(300)), (snap) => {
        setActivity(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      })
    );

    return () => unsubs.forEach((u) => u());
  }, [uid]);

  const api = useMemo(() => (uid ? makeApi(uid) : null), [uid]);

  const value = useMemo(() => {
    const printers = data.printers || [];
    const spools = data.spools || [];
    const projects = data.projects || [];
    const clients = data.clients || [];
    const materials = data.materials || [];
    const byId = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));

    return {
      uid,
      api,
      ready,
      settings,
      printers,
      spools,
      projects,
      clients,
      orders: data.orders || [],
      transactions: data.transactions || [],
      maintenanceRecords: data.maintenanceRecords || [],
      maintenanceParts: data.maintenanceParts || [],
      profiles: data.profiles || [],
      materials,
      suppliers: data.suppliers || [],
      templates: data.templates || [],
      packagingItems: data.packagingItems || [],
      activity,
      printersById: byId(printers),
      spoolsById: byId(spools),
      projectsById: byId(projects),
      clientsById: byId(clients),
      materialNames: [
        ...materials.map((m) => m.name),
        ...(settings.customMaterials || []),
      ].sort((a, b) => a.localeCompare(b)),
      brandNames: [...DEFAULT_BRANDS, ...(settings.customBrands || [])].sort((a, b) =>
        a.localeCompare(b)
      ),
    };
  }, [uid, api, ready, settings, data, activity]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => useContext(DataContext);
