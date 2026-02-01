
const DB_NAME = "ferusher_db";
const DB_VERSION = 2;
const STORE_NAME = "ai_analyses";
const STATIC_STORE_NAME = "static_data";

export interface CachedAnalysis {
    id: number;
    data: string | { coach: string; deep: string; quick: string };
    timestamp: number;
}

export interface CachedStaticData {
    key: string; // e.g., 'interview_questions'
    data: any;
    timestamp: number;
}

export const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject("IndexedDB error");

        request.onsuccess = (event) => {
            resolve((event.target as IDBOpenDBRequest).result);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains(STATIC_STORE_NAME)) {
                db.createObjectStore(STATIC_STORE_NAME, { keyPath: "key" });
            }
        };
    });
};

export const saveAnalysis = async (id: number, data: CachedAnalysis['data']) => {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put({ id, data, timestamp: Date.now() });

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const getAnalysis = async (id: number): Promise<CachedAnalysis | undefined> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const deleteAnalysis = async (id: number) => {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const clearAllAnalysis = async () => {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Static Data Methods
export const saveStaticData = async (key: string, data: any) => {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([STATIC_STORE_NAME], "readwrite");
        const store = transaction.objectStore(STATIC_STORE_NAME);
        const request = store.put({ key, data, timestamp: Date.now() });

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const getStaticData = async (key: string): Promise<CachedStaticData | undefined> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STATIC_STORE_NAME], "readonly");
        const store = transaction.objectStore(STATIC_STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};
