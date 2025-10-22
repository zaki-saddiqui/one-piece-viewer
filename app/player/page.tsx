"use client"

import { useEffect, useState, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  getArc,
  getEpisodes,
  getPlaybackProgress,
  savePlaybackProgress,
  getFileHandle,
  saveHandleStatus,
  getDescription,
  saveDescription,
  type ArcMetadata,
  type EpisodeMetadata,
  type PlaybackProgress,
  type EpisodeDescription,
} from "@/lib/db"
import { getVideoFile, findDescriptionFile, readDescriptionFile, writeDescriptionFile } from "@/lib/file-system"
import { VideoPlayer } from "@/components/video-player"
import { EpisodeDescriptionComponent } from "@/components/episode-description"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"

export default function PlayerPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const arcSlug = searchParams.get("arc")
  const episodeIndex = Number.parseInt(searchParams.get("episode") || "0")

  const [arc, setArc] = useState<ArcMetadata | null>(null)
  const [episodes, setEpisodes] = useState<EpisodeMetadata[]>([])
  const [currentEpisode, setCurrentEpisode] = useState<EpisodeMetadata | null>(null)
  const [showPlaylist, setShowPlaylist] = useState(true)
  const [autoPlayNext, setAutoPlayNext] = useState(true)
  const [loading, setLoading] = useState(true)
  const [videoUrl, setVideoUrl] = useState<string>("")
  const [stableId, setStableId] = useState<string>("")
  const [resumeTime, setResumeTime] = useState<number | null>(null)
  const [autoplayBlocked, setAutoplayBlocked] = useState(false)
  const [description, setDescription] = useState<EpisodeDescription | null>(null)
  const [descriptionLoading, setDescriptionLoading] = useState(false)
  const [arcHandle, setArcHandle] = useState<FileSystemDirectoryHandle | null>(null)
  const [handleError, setHandleError] = useState<string | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (arcSlug) {
      loadPlayerData()
    }
  }, [arcSlug, episodeIndex])

  async function loadPlayerData() {
    setLoading(true)
    setAutoplayBlocked(false)
    setHandleError(null)
    try {
      const arcData = await getArc(arcSlug!)
      if (arcData) {
        setArc(arcData)
        const episodesData = await getEpisodes(arcSlug!)
        setEpisodes(episodesData)

        if (episodesData[episodeIndex]) {
          setCurrentEpisode(episodesData[episodeIndex])
          await loadEpisodeVideo(episodesData[episodeIndex], arcData, arcSlug!)
        }
      }
    } catch (error) {
      console.error("Error loading player data:", error)
    } finally {
      setLoading(false)
    }
  }

  async function loadEpisodeVideo(episode: EpisodeMetadata, arcData: ArcMetadata, arcSlug: string) {
    try {
      if (!arcData.name) {
        console.error("[v0] Arc name is missing")
        setHandleError("Arc information is missing. Please go back and select the directory again.")
        return
      }

      const rootHandle = await getFileHandle("root")
      if (!rootHandle) {
        console.error("[v0] Root handle not found")
        setHandleError("Directory access expired. Please go back to home and select your directory again.")
        return
      }

      let arcHandleObj: FileSystemDirectoryHandle
      try {
        await rootHandle.handle.queryPermission({ mode: "read" })
        arcHandleObj = await rootHandle.handle.getDirectoryHandle(arcData.name)
      } catch (error: any) {
        console.error("[v0] File handle is stale or expired:", error.message)
        await saveHandleStatus("root", "stale")
        setHandleError(
          "Your directory access has expired. This can happen after a browser restart or if permissions were revoked. Please go back to home and select your directory again.",
        )
        return
      }

      setArcHandle(arcHandleObj)

      let fileHandle: FileSystemFileHandle
      try {
        fileHandle = await arcHandleObj.getFileHandle(episode.fileName)
      } catch (error: any) {
        console.error("[v0] Episode file not found:", error.message)
        setHandleError(`Episode file "${episode.fileName}" not found in the directory.`)
        return
      }

      const episodeFile = await getVideoFile(fileHandle)

      const lastModified = episodeFile.lastModified
      const id = `${arcSlug}::${episode.fileName}::${lastModified}`
      setStableId(id)

      const url = URL.createObjectURL(episodeFile)
      setVideoUrl(url)

      const progress = await getPlaybackProgress(id)
      if (progress && progress.currentTime > 0) {
        console.log("[v0] Found saved progress at", progress.currentTime)
        setResumeTime(progress.currentTime)
      }

      await saveHandleStatus(`file:${id}`, "ok")

      await loadDescription(episode, arcHandleObj, lastModified)
    } catch (error: any) {
      console.error("Error loading episode video:", error)
      if (stableId) {
        await saveHandleStatus(`file:${stableId}`, "stale")
      }
      setHandleError("Failed to load episode. Please try again or go back to home to re-select your directory.")
    }
  }

  async function loadDescription(
    episode: EpisodeMetadata,
    arcHandleObj: FileSystemDirectoryHandle,
    lastModified: number,
  ) {
    setDescriptionLoading(true)
    try {
      // Check if description is cached
      const cached = await getDescription(episode.id)
      if (cached && cached.lastModified === lastModified) {
        setDescription(cached)
        setDescriptionLoading(false)
        return
      }

      // Try to find description file
      const descFile = await findDescriptionFile(arcHandleObj, episode.fileName)
      if (descFile) {
        const text = await readDescriptionFile(descFile)
        const desc: EpisodeDescription = {
          id: `${episode.id}-desc`,
          episodeId: episode.id,
          arcId: episode.arcId,
          fileName: episode.fileName,
          text,
          source: "disk",
          lastModified,
          lastUpdated: Date.now(),
        }
        await saveDescription(desc)
        setDescription(desc)
      } else {
        // Check if there's a local-only description
        const localDesc = await getDescription(episode.id)
        if (localDesc) {
          setDescription(localDesc)
        } else {
          setDescription(null)
        }
      }
    } catch (error) {
      console.error("Error loading description:", error)
      setDescription(null)
    } finally {
      setDescriptionLoading(false)
    }
  }

  async function handleDescriptionSave(text: string, saveToFile: boolean) {
    if (!currentEpisode) return

    const lastModified = stableId.split("::")[2] ? Number.parseInt(stableId.split("::")[2]) : Date.now()
    const desc: EpisodeDescription = {
      id: `${currentEpisode.id}-desc`,
      episodeId: currentEpisode.id,
      arcId: currentEpisode.arcId,
      fileName: currentEpisode.fileName,
      text,
      source: saveToFile && arcHandle ? "disk" : "local",
      lastModified,
      lastUpdated: Date.now(),
    }

    await saveDescription(desc)
    setDescription(desc)

    // Save to disk if requested
    if (saveToFile && arcHandle) {
      const success = await writeDescriptionFile(arcHandle, currentEpisode.fileName, text)
      if (!success) {
        throw new Error("Failed to write description to disk. Changes saved locally.")
      }
    }
  }

  function handleTimeUpdate(currentTime: number) {
    if (!currentEpisode || !stableId) return

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      const progress: PlaybackProgress = {
        id: stableId,
        episodeId: currentEpisode.id,
        arcId: currentEpisode.arcId,
        currentTime,
        duration: 0,
        lastWatched: Date.now(),
      }
      savePlaybackProgress(progress)
    }, 1000)
  }

  function handleResumeClick() {
    setAutoplayBlocked(false)
    setResumeTime(null)
  }

  function handleEnded() {
    if (autoPlayNext && episodes.length > episodeIndex + 1) {
      router.push(`/player?arc=${arcSlug}&episode=${episodeIndex + 1}`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading player...</div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="flex flex-col lg:flex-row gap-6 p-6 max-w-7xl mx-auto">
        {/* Video Player */}
        <div className="flex-1">
          <Link href={`/arc/${arcSlug}`}>
            <Button variant="ghost" className="mb-4 cursor-pointer">
              ← Back to Arc
            </Button>
          </Link>

          {handleError && (
            <Card className="mb-4 p-4 bg-destructive/10 border-destructive/20">
              <p className="text-sm text-destructive">{handleError}</p>
              <Link href="/">
                <Button variant="outline" size="sm" className="mt-2 bg-transparent">
                  Go to Home
                </Button>
              </Link>
            </Card>
          )}

          <Card className="overflow-hidden bg-black">
            {videoUrl && (
              <VideoPlayer
                src={videoUrl}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
                autoPlay={!autoplayBlocked}
                resumeTime={resumeTime ?? undefined}
                onResumeClick={handleResumeClick}
              />
            )}
          </Card>

          {currentEpisode && (
            <div className="mt-4">
              <h1 className="text-2xl font-bold text-foreground">{currentEpisode.displayName}</h1>
              <p className="text-muted-foreground mt-2">{arc?.displayName}</p>
            </div>
          )}

          {currentEpisode && (
            <EpisodeDescriptionComponent
              description={description}
              isLoading={descriptionLoading}
              onSave={handleDescriptionSave}
            />
          )}
        </div>

        {/* Playlist Sidebar */}
        <AnimatePresence>
          {showPlaylist && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="w-full lg:w-80 flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-foreground">Playlist</h2>
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={autoPlayNext}
                      onChange={(e) => setAutoPlayNext(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-gray-300 rounded-full peer-checked:bg-blue-600 transition-colors duration-200"></div>
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-200 peer-checked:translate-x-5"></div>
                  </div>
                  <span className="text-muted-foreground">Auto-play next</span>
                </label>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2">
                {episodes.map((episode, index) => (
                  <motion.div
                    key={episode.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card
                      className={`cursor-pointer p-3 transition-all ${
                        currentEpisode?.id === episode.id ? "bg-primary text-primary-foreground" : "hover:bg-card"
                      }`}
                      onClick={() => {
                        router.push(`/player?arc=${arcSlug}&episode=${index}`)
                      }}
                    >
                      <div className="flex gap-3">
                        {episode.thumbnail && (
                          <img
                            src={episode.thumbnail || "/placeholder.svg"}
                            alt={episode.displayName}
                            className="w-16 h-12 object-cover rounded"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{episode.displayName}</p>
                          <p className="text-xs opacity-75 truncate">{episode.fileName}</p>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  )
}
