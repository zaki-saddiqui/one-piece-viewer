"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { initDB, getArcs, saveArc, saveFileHandle } from "@/lib/db"
import { discoverArcs, discoverEpisodes, extractVideoThumbnail, findCoverImage } from "@/lib/file-system"
import { type ArcMetadata, type EpisodeMetadata, saveEpisode } from "@/lib/db"
import { motion } from "framer-motion"
import Link from "next/link"

export default function Home() {
  const router = useRouter()
  const [arcs, setArcs] = useState<ArcMetadata[]>([])
  const [loading, setLoading] = useState(false)
  const [hasPermission, setHasPermission] = useState(false)

  useEffect(() => {
    initDB().then(() => {
      loadArcs()
      checkFileSystemAccess()
    })
  }, [])

  async function checkFileSystemAccess() {
    if ("showDirectoryPicker" in window) {
      setHasPermission(true)
    }
  }

  async function loadArcs() {
    const loadedArcs = await getArcs()
    setArcs(loadedArcs)
  }

  async function handlePickDirectory() {
    if (!("showDirectoryPicker" in window)) {
      alert("File System Access API not supported in your browser")
      return
    }

    setLoading(true)
    try {
      const rootHandle = await (window as any).showDirectoryPicker()
      await saveFileHandle("root", rootHandle, "one-piece")

      // Discover arcs
      const discoveredArcs = await discoverArcs(rootHandle)

      for (const discoveredArc of discoveredArcs) {
        const arcId = discoveredArc.id
        const existingArc = arcs.find((a) => a.id === arcId)

        if (!existingArc) {
          let coverImage: string | undefined
          try {
            const coverFile = await findCoverImage(discoveredArc.handle)
            if (coverFile) {
              const reader = new FileReader()
              coverImage = await new Promise((resolve) => {
                reader.onload = () => resolve(reader.result as string)
                reader.readAsDataURL(coverFile)
              })
            }
          } catch (error) {
            console.error("Error finding cover image:", error)
          }

          const arcMetadata: ArcMetadata = {
            id: arcId,
            name: discoveredArc.name,
            displayName: discoveredArc.name,
            coverImage,
            order: arcs.length,
            createdAt: Date.now(),
          }
          await saveArc(arcMetadata)

          // Discover episodes for this arc
          const episodes = await discoverEpisodes(discoveredArc.handle)
          for (let i = 0; i < episodes.length; i++) {
            const episodeFile = await episodes[i].handle.getFile()

            const episodeMetadata: EpisodeMetadata = {
              id: `${arcId}-ep-${i + 1}`,
              arcId,
              fileName: episodes[i].name,
              displayName: episodes[i].episodeNumber ? `Episode ${episodes[i].episodeNumber}` : `Episode ${i + 1}`,
              duration: 0,
              order: i,
              episodeNumber: episodes[i].episodeNumber,
              createdAt: Date.now(),
            }

            // Extract thumbnail
            try {
              const thumbnail = await extractVideoThumbnail(episodeFile)
              const reader = new FileReader()
              reader.onload = async () => {
                episodeMetadata.thumbnail = reader.result as string
                await saveEpisode(episodeMetadata)
              }
              reader.readAsDataURL(thumbnail)
            } catch (error) {
              console.error("Error extracting thumbnail:", error)
              await saveEpisode(episodeMetadata)
            }
          }
        }
      }

      await loadArcs()
    } catch (error) {
      console.error("Error picking directory:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-card p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 flex items-center justify-between"
        >
          <div>
            <h1 className="text-5xl font-bold text-foreground mb-2">One Piece Viewer</h1>
            <p className="text-muted-foreground text-lg">Organize and watch your One Piece episodes locally</p>
          </div>
          <Link href="/settings">
            <Button variant="outline" size="sm" className="cursor-pointer bg-transparent">
              Settings
            </Button>
          </Link>
        </motion.div>

        {/* Main Content */}
        {arcs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <Card className="p-12 text-center max-w-md">
              <h2 className="text-2xl font-bold mb-4">Get Started</h2>
              <p className="text-muted-foreground mb-6">Select your one-piece folder to discover arcs and episodes</p>
              <Button
                onClick={handlePickDirectory}
                disabled={!hasPermission || loading}
                size="lg"
                className="w-full cursor-pointer"
              >
                {loading ? "Discovering..." : "Pick Directory"}
              </Button>
              {!hasPermission && <p className="text-sm text-destructive mt-4">File System Access API not supported</p>}
            </Card>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            {/* Arc Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {arcs.map((arc, index) => (
                <motion.div
                  key={arc.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card
                    className="cursor-pointer hover:shadow-lg transition-shadow overflow-hidden group"
                    onClick={() => router.push(`/arc/${arc.id}`)}
                  >
                    <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
                      {arc.coverImage ? (
                        <img
                          src={arc.coverImage || "/placeholder.svg"}
                          alt={arc.displayName}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="text-muted-foreground text-center p-4">
                          <div className="text-4xl mb-2">🏴‍☠️</div>
                          <p className="text-sm">No cover image</p>
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-lg text-foreground">{arc.displayName}</h3>
                      {arc.description && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{arc.description}</p>
                      )}
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Refresh Button */}
            <div className="flex justify-center">
              <Button
                onClick={handlePickDirectory}
                variant="outline"
                disabled={loading}
                className="cursor-pointer bg-transparent"
              >
                {loading ? "Refreshing..." : "Refresh Directory"}
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </main>
  )
}
