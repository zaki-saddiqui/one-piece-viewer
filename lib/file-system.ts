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
  // Split filenames into parts (numbers and non-numbers)
  const aParts = a.split(/(\d+)/).filter(Boolean)
  const bParts = b.split(/(\d+)/).filter(Boolean)

  // Compare each part
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] || ""
    const bPart = bParts[i] || ""

    // If both parts are numbers, compare numerically
    if (/^\d+$/.test(aPart) && /^\d+$/.test(bPart)) {
      const aNum = Number.parseInt(aPart)
      const bNum = Number.parseInt(bPart)
      if (aNum !== bNum) return aNum - bNum
    } else {
      // Otherwise, compare as strings
      const comparison = aPart.localeCompare(bPart, undefined, { numeric: true, sensitivity: "base" })
      if (comparison !== 0) return comparison
    }
  }

  return 0
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

export async function findDescriptionFile(
  arcHandle: FileSystemDirectoryHandle,
  videoFileName: string,
): Promise<File | null> {
  try {
    const baseName = videoFileName.substring(0, videoFileName.lastIndexOf("."))

    // Try exact match first
    try {
      const fileHandle = await arcHandle.getFileHandle(`${baseName}.txt`)
      return await fileHandle.getFile()
    } catch {
      // Try case-insensitive search
      for await (const entry of arcHandle.entries()) {
        const [name, handle] = entry
        if (handle.kind === "file") {
          const entryBaseName = name.substring(0, name.lastIndexOf("."))
          const entryExt = name.substring(name.lastIndexOf(".")).toLowerCase()

          if (entryBaseName.toLowerCase() === baseName.toLowerCase() && entryExt === ".txt") {
            return await (handle as FileSystemFileHandle).getFile()
          }
        }
      }
    }
  } catch (error) {
    console.error("Error finding description file:", error)
  }
  return null
}

export async function readDescriptionFile(file: File): Promise<string> {
  try {
    const text = await file.text()
    return text
  } catch (error) {
    console.error("Error reading description file:", error)
    throw new Error("Failed to read description file")
  }
}

export async function writeDescriptionFile(
  arcHandle: FileSystemDirectoryHandle,
  videoFileName: string,
  content: string,
): Promise<boolean> {
  try {
    const baseName = videoFileName.substring(0, videoFileName.lastIndexOf("."))
    const fileHandle = await arcHandle.getFileHandle(`${baseName}.txt`, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(content)
    await writable.close()
    return true
  } catch (error) {
    console.error("Error writing description file:", error)
    return false
  }
}
