/**
 * KerkDB - IndexedDB Storage Manager voor Kerkapp
 * Biedt veilige, onbeperkte opslag voor grote bestanden zoals foto-dia's,
 * achtergrondafbeeldingen en volledige presentaties (voorkomt 5MB localStorage quota errors).
 */

(function() {
    'use strict';

    const DB_NAME = 'KerkappMediaDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'media';

    let _dbPromise = null;

    function getDB() {
        if (_dbPromise) return _dbPromise;

        _dbPromise = new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                console.warn('IndexedDB niet ondersteund door deze browser.');
                resolve(null);
                return;
            }

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = function(event) {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };

            request.onsuccess = function(event) {
                resolve(event.target.result);
            };

            request.onerror = function(event) {
                console.error('Fout bij openen van IndexedDB:', event.target.error);
                resolve(null);
            };
        });

        return _dbPromise;
    }

    const KerkDB = {
        async setItem(id, data) {
            try {
                const db = await getDB();
                if (!db) return false;

                return new Promise((resolve) => {
                    const tx = db.transaction(STORE_NAME, 'readwrite');
                    const store = tx.objectStore(STORE_NAME);
                    store.put({ id: id, data: data, timestamp: Date.now() });

                    tx.oncomplete = () => resolve(true);
                    tx.onerror = (e) => {
                        console.warn('KerkDB opslagfout:', e.target.error);
                        resolve(false);
                    };
                });
            } catch (err) {
                console.warn('KerkDB setItem fout:', err);
                return false;
            }
        },

        async getItem(id) {
            try {
                const db = await getDB();
                if (!db) return null;

                return new Promise((resolve) => {
                    const tx = db.transaction(STORE_NAME, 'readonly');
                    const store = tx.objectStore(STORE_NAME);
                    const req = store.get(id);

                    req.onsuccess = () => {
                        resolve(req.result ? req.result.data : null);
                    };
                    req.onerror = () => resolve(null);
                });
            } catch (err) {
                console.warn('KerkDB getItem fout:', err);
                return null;
            }
        },

        async removeItem(id) {
            try {
                const db = await getDB();
                if (!db) return false;

                return new Promise((resolve) => {
                    const tx = db.transaction(STORE_NAME, 'readwrite');
                    const store = tx.objectStore(STORE_NAME);
                    store.delete(id);
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = () => resolve(false);
                });
            } catch (err) {
                return false;
            }
        },

        async clear() {
            try {
                const db = await getDB();
                if (!db) return false;

                return new Promise((resolve) => {
                    const tx = db.transaction(STORE_NAME, 'readwrite');
                    const store = tx.objectStore(STORE_NAME);
                    store.clear();
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = () => resolve(false);
                });
            } catch (err) {
                return false;
            }
        }
    };

    window.KerkDB = KerkDB;
})();
