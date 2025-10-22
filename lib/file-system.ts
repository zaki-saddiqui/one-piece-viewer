export interface DiscoveredArc {
  id: string
  name: string
  handle: FileSystemDirectoryHandle
}

export interface DiscoveredEpisode {
  name: string
  handle: FileSystemFileHandle
  episodeNumber?: number
}

const VIDEO_EXTENSIONS = [".mp4", ".mkv", ".webm", ".avi", ".mov"]
const COVER_NAMES = ["cover.jpg", "cover.jpeg", "cover.png", "folder.jpg", "arc.jpg"]

function isVideoFile(name: string): boolean {
  return VIDEO_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext))
}

function parseEpisodeNumber(filename: string): number | null {
  const match = filename.match(/^(\d+)/)
  return match ? Number.parseInt(match[1]) : null
}

function naturalSort(a: string, b: string): number {
  const aNum = parseEpisodeNumber(a)
  const bNum = parseEpisodeNumber(b)

  // Both have numbers: sort by numeric value
  if (aNum !== null && bNum !== null) {
    return aNum - bNum
  }

  // Only a has number: a comes first
  if (aNum !== null) return -1

  // Only b has number: b comes first
  if (bNum !== null) return 1

  // Neither has number: natural sort by filename
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
}

export async function discoverArcs(rootHandle: FileSystemDirectoryHandle): Promise<DiscoveredArc[]> {
  const arcs: DiscoveredArc[] = []

  try {
    for await (const entry of rootHandle.entries()) {
      const [name, handle] = entry
      if (handle.kind === "directory") {
        arcs.push({
          id: name.toLowerCase().replace(/\s+/g, "-"),
          name,
          handle: handle as FileSystemDirectoryHandle,
        })
      }
    }
  } catch (error) {
    console.error("Error discovering arcs:", error)
  }

  return arcs.sort((a, b) => naturalSort(a.name, b.name))
}

export async function discoverEpisodes(arcHandle: FileSystemDirectoryHandle): Promise<DiscoveredEpisode[]> {
  const episodes: DiscoveredEpisode[] = []

  try {
    for await (const entry of arcHandle.entries()) {
      const [name, handle] = entry
      if (handle.kind === "file" && isVideoFile(name)) {
        episodes.push({
          name,
          handle: handle as FileSystemFileHandle,
          episodeNumber: parseEpisodeNumber(name),
        })
      }
    }
  } catch (error) {
    console.error("Error discovering episodes:", error)
  }

  return episodes.sort((a, b) => naturalSort(a.name, b.name))
}

export async function findCoverImage(arcHandle: FileSystemDirectoryHandle): Promise<File | null> {
  try {
    for (const coverName of COVER_NAMES) {
      try {
        const fileHandle = await arcHandle.getFileHandle(coverName)
        return await fileHandle.getFile()
      } catch {
        // File not found, try next
      }
    }
  } catch (error) {
    console.error("Error finding cover image:", error)
  }
  return null
}

export async function getVideoFile(fileHandle: FileSystemFileHandle): Promise<File> {
  return fileHandle.getFile()
}

export async function extractVideoThumbnail(file: File, timeOffset = 1): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video")
    video.crossOrigin = "anonymous"
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")

    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      video.currentTime = Math.min(timeOffset, video.duration * 0.1)
    }

    video.onseeked = () => {
      if (ctx) {
        ctx.drawImage(video, 0, 0)
        canvas.toBlob(resolve, "image/jpeg", 0.7)
      }
    }

    video.onerror = () => reject(new Error("Failed to load video"))

    const url = URL.createObjectURL(file)
    video.src = url
  })
}
