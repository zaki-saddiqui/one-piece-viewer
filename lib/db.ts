// IndexedDB utilities for storing metadata, file handles, thumbnails, and playback progress
import { openDB, type DBSchema, type IDBPDatabase } from "idb"

export interface ArcMetadata {
  id: string
  name: string
  displayName: string
  coverImage?: string
  description?: string
  order: number
  createdAt: number
}

export interface EpisodeMetadata {
  id: string
  arcId: string
  fileName: string
  displayName: string
  duration: number
  thumbnail?: string
  order: number
  createdAt: number
}

export interface PlaybackProgress {
  id: string
  episodeId: string
  arcId: string
  currentTime: number
  duration: number
  lastWatched: number
}

export interface FileHandleStatus {
  id: string
  status: "ok" | "stale" | "missing"
  lastVerified: number
}

export interface FileHandleStore {
  id: string
  handle: FileSystemDirectoryHandle
  name: string
  savedAt: number
}

interface OnePieceDB extends DBSchema {
  arcs: {
    key: string
    value: ArcMetadata
    indexes: { "by-order": number }
  }
  episodes: {
    key: string
    value: EpisodeMetadata
    indexes: { "by-arc": string; "by-order": number }
  }
  playback: {
    key: string
    value: PlaybackProgress
    indexes: { "by-arc": string; "by-episode": string }
  }
  fileHandles: {
    key: string
    value: FileHandleStore
  }
  handleStatus: {
    key: string
    value: FileHandleStatus
  }
  thumbnails: {
    key: string
    value: { episodeId: string; blob: Blob }
  }
}

let db: IDBPDatabase<OnePieceDB> | null = null

export async function initDB() {
  if (db) return db

  db = await openDB<OnePieceDB>("one-piece-viewer", 2, {
    upgrade(db, oldVersion) {
      // Arcs store
      if (!db.objectStoreNames.contains("arcs")) {
        const arcStore = db.createObjectStore("arcs", { keyPath: "id" })
        arcStore.createIndex("by-order", "order")
      }

      // Episodes store
      if (!db.objectStoreNames.contains("episodes")) {
        const episodeStore = db.createObjectStore("episodes", { keyPath: "id" })
        episodeStore.createIndex("by-arc", "arcId")
        episodeStore.createIndex("by-order", "order")
      }

      // Playback progress store
      if (!db.objectStoreNames.contains("playback")) {
        const playbackStore = db.createObjectStore("playback", { keyPath: "episodeId" })
        playbackStore.createIndex("by-arc", "arcId")
      }

      // File handles store
      if (!db.objectStoreNames.contains("fileHandles")) {
        db.createObjectStore("fileHandles", { keyPath: "id" })
      }

      if (!db.objectStoreNames.contains("handleStatus")) {
        db.createObjectStore("handleStatus", { keyPath: "id" })
      }

      // Thumbnails store
      if (!db.objectStoreNames.contains("thumbnails")) {
        db.createObjectStore("thumbnails", { keyPath: "episodeId" })
      }
    },
  })

  return db
}

export async function getDB() {
  if (!db) {
    await initDB()
  }
  return db!
}

// Arc operations
export async function saveArc(arc: ArcMetadata) {
  const database = await getDB()
  await database.put("arcs", arc)
}

export async function getArcs() {
  const database = await getDB()
  return database.getAllFromIndex("arcs", "by-order")
}

export async function getArc(id: string) {
  const database = await getDB()
  return database.get("arcs", id)
}

export async function deleteArc(id: string) {
  const database = await getDB()
  await database.delete("arcs", id)
  // Delete associated episodes
  const episodes = await database.getAllFromIndex("episodes", "by-arc", id)
  for (const ep of episodes) {
    await database.delete("episodes", ep.id)
  }
}

// Episode operations
export async function saveEpisode(episode: EpisodeMetadata) {
  const database = await getDB()
  await database.put("episodes", episode)
}

export async function getEpisodes(arcId: string) {
  const database = await getDB()
  return database.getAllFromIndex("episodes", "by-arc", arcId)
}

export async function getEpisode(id: string) {
  const database = await getDB()
  return database.get("episodes", id)
}

// Playback progress operations
export async function savePlaybackProgress(progress: PlaybackProgress) {
  const database = await getDB()
  await database.put("playback", progress)
}

export async function getPlaybackProgress(stableId: string) {
  const database = await getDB()
  return database.get("playback", stableId)
}

// File handle operations
export async function saveFileHandle(id: string, handle: FileSystemDirectoryHandle, name: string) {
  const database = await getDB()
  await database.put("fileHandles", {
    id,
    handle,
    name,
    savedAt: Date.now(),
  })
}

export async function getFileHandle(id: string) {
  const database = await getDB()
  return database.get("fileHandles", id)
}

export async function getAllFileHandles() {
  const database = await getDB()
  return database.getAll("fileHandles")
}

export async function saveHandleStatus(id: string, status: "ok" | "stale" | "missing") {
  const database = await getDB()
  await database.put("handleStatus", {
    id,
    status,
    lastVerified: Date.now(),
  })
}

export async function getHandleStatus(id: string) {
  const database = await getDB()
  return database.get("handleStatus", id)
}

export async function getAllHandleStatuses() {
  const database = await getDB()
  return database.getAll("handleStatus")
}

// Thumbnail operations
export async function saveThumbnail(episodeId: string, blob: Blob) {
  const database = await getDB()
  await database.put("thumbnails", { episodeId, blob })
}

export async function getThumbnail(episodeId: string) {
  const database = await getDB()
  return database.get("thumbnails", episodeId)
}

// Export/Import
export async function exportMetadata() {
  const database = await getDB()
  const arcs = await database.getAll("arcs")
  const episodes = await database.getAll("episodes")
  const playback = await database.getAll("playback")

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    arcs,
    episodes,
    playback,
  }
}

export async function importMetadata(data: any) {
  const database = await getDB()
  const tx = database.transaction(["arcs", "episodes", "playback"], "readwrite")

  for (const arc of data.arcs) {
    await tx.objectStore("arcs").put(arc)
  }
  for (const episode of data.episodes) {
    await tx.objectStore("episodes").put(episode)
  }
  for (const progress of data.playback) {
    await tx.objectStore("playback").put(progress)
  }

  await tx.done
}
