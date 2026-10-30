// Skin photos stay on this device, in IndexedDB. localStorage is too small for
// them. Each photo is a JPEG data URL of at most 768 px.

export interface Photo {
  id: string
  date: string
  at: string
  kind: 'skin'
  dataUrl: string
}

const DB = 'momo'
const STORE = 'photos'

let db: Promise<IDBDatabase> | undefined
function open(): Promise<IDBDatabase> {
  return (db ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  }))
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await open()
  return new Promise((resolve, reject) => {
    const req = run(d.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export const putPhoto = (p: Photo) => tx('readwrite', (s) => s.put(p)).then(() => p)
export const getPhoto = (id: string) => tx<Photo | undefined>('readonly', (s) => s.get(id))
export const allPhotos = () => tx<Photo[]>('readonly', (s) => s.getAll()).then((xs) => xs.sort((a, b) => a.at.localeCompare(b.at)))
export const deletePhoto = (id: string) => tx('readwrite', (s) => s.delete(id))
export const clearPhotos = () => tx('readwrite', (s) => s.clear())
