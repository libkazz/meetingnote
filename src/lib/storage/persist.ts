// Simple persistence wrapper: IndexedDB with localStorage fallback
// Stores only lightweight key/value pairs.

const DB_NAME = 'meetingnote';
const STORE = 'kv';
const REV_STORE = 'revisions';
const SUMMARY_KEY = 'summaryResult';
const LS_KEY = 'meetingnote.summaryResult';
const LS_REV_PREFIX = 'meetingnote.revisions.';

type KV = { key: string; value: unknown; updatedAt: number };
export type Revision = { meetingId: string; rev: number; timestamp: number; content: string };
type RevisionDoc = { meetingId: string; latestRev: number; items: Revision[] };

function hasIndexedDB(): boolean {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(REV_STORE)) {
        db.createObjectStore(REV_STORE, { keyPath: 'meetingId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('indexedDB open error'));
  });
}

async function idbGet(key: string): Promise<unknown | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const req = store.get(key);
    req.onsuccess = () => resolve((req.result as KV | undefined)?.value);
    req.onerror = () => reject(req.error || new Error('indexedDB get error'));
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.put({ key, value, updatedAt: Date.now() } as KV);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error('indexedDB put error'));
  });
}

export async function getSummaryResult(): Promise<string> {
  try {
    if (hasIndexedDB()) {
      const v = await idbGet(SUMMARY_KEY);
      if (typeof v === 'string') return v;
    }
  } catch {
    // fallthrough to localStorage
  }
  try {
    return localStorage.getItem(LS_KEY) || '';
  } catch {
    return '';
  }
}

export async function setSummaryResult(text: string): Promise<void> {
  try {
    if (hasIndexedDB()) {
      await idbSet(SUMMARY_KEY, text);
      return;
    }
  } catch {
    // fallback
  }
  try {
    localStorage.setItem(LS_KEY, text);
  } catch {
    // ignore
  }
}

// Revisions API (IndexedDB with localStorage fallback)
async function idbGetRevisionDoc(meetingId: string): Promise<RevisionDoc | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(REV_STORE, 'readonly');
    const store = tx.objectStore(REV_STORE);
    const req = store.get(meetingId);
    req.onsuccess = () => resolve(req.result as RevisionDoc | undefined);
    req.onerror = () => reject(req.error || new Error('indexedDB revisions get error'));
  });
}

async function idbPutRevisionDoc(doc: RevisionDoc): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(REV_STORE, 'readwrite');
    const store = tx.objectStore(REV_STORE);
    const req = store.put(doc);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error('indexedDB revisions put error'));
  });
}

export async function loadLatestResult(meetingId: string): Promise<string> {
  try {
    if (hasIndexedDB()) {
      const doc = await idbGetRevisionDoc(meetingId);
      const last = doc?.items?.[doc.items.length - 1];
      if (last && typeof last.content === 'string') return last.content;
    }
  } catch {
    // fallthrough
  }
  try {
    const raw = localStorage.getItem(LS_REV_PREFIX + meetingId);
    if (raw) {
      const doc = JSON.parse(raw) as RevisionDoc;
      const last = doc?.items?.[doc.items.length - 1];
      return (last?.content as string) || '';
    }
  } catch {
    // ignore
  }
  return '';
}

export async function saveResultRevision(meetingId: string, content: string, maxKeep = 100): Promise<void> {
  // IndexedDB path
  try {
    if (hasIndexedDB()) {
      const existing = (await idbGetRevisionDoc(meetingId)) || { meetingId, latestRev: 0, items: [] };
      const last = existing.items[existing.items.length - 1];
      if (last && last.content === content) return; // no diff
      const rev = (existing.latestRev || 0) + 1;
      const item: Revision = { meetingId, rev, timestamp: Date.now(), content };
      const items = [...existing.items, item];
      const trimmed = items.length > maxKeep ? items.slice(items.length - maxKeep) : items;
      await idbPutRevisionDoc({ meetingId, latestRev: rev, items: trimmed });
      return;
    }
  } catch {
    // fallback
  }
  // localStorage fallback
  try {
    const key = LS_REV_PREFIX + meetingId;
    const raw = localStorage.getItem(key);
    const existing: RevisionDoc = raw ? JSON.parse(raw) : { meetingId, latestRev: 0, items: [] };
    const last = existing.items[existing.items.length - 1];
    if (last && last.content === content) return;
    const rev = (existing.latestRev || 0) + 1;
    const item: Revision = { meetingId, rev, timestamp: Date.now(), content };
    const nextItems = [...existing.items, item];
    const trimmed = nextItems.length > maxKeep ? nextItems.slice(nextItems.length - maxKeep) : nextItems;
    const doc: RevisionDoc = { meetingId, latestRev: rev, items: trimmed };
    localStorage.setItem(key, JSON.stringify(doc));
  } catch {
    // ignore
  }
}

export async function listRevisions(meetingId: string): Promise<Revision[]> {
  // Return newest-first list
  try {
    if (hasIndexedDB()) {
      const doc = await idbGetRevisionDoc(meetingId);
      const items = doc?.items || [];
      return [...items].sort((a, b) => b.rev - a.rev);
    }
  } catch {
    // fallthrough
  }
  try {
    const raw = localStorage.getItem(LS_REV_PREFIX + meetingId);
    if (!raw) return [];
    const doc = JSON.parse(raw) as RevisionDoc;
    const items = doc?.items || [];
    return [...items].sort((a, b) => b.rev - a.rev);
  } catch {
    return [];
  }
}
