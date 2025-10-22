"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { getArc, getEpisodes, type ArcMetadata, type EpisodeMetadata } from "@/lib/db"
import { motion } from "framer-motion"
import Link from "next/link"

export default function ArcPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [arc, setArc] = useState<ArcMetadata | null>(null)
  const [episodes, setEpisodes] = useState<EpisodeMetadata[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadArcData()
  }, [slug])

  async function loadArcData() {
    setLoading(true)
    try {
      const arcData = await getArc(slug)
      if (arcData) {
        setArc(arcData)
        const episodesData = await getEpisodes(slug)
        setEpisodes(episodesData)
      }
    } catch (error) {
      console.error("Error loading arc:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!arc) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Arc not found</h1>
          <Link href="/">
            <Button>Back to Home</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b border-border shadow-md">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <Link href="/">
            <Button variant="ghost" className="mb-4 cursor-pointer">
              ← Back
            </Button>
          </Link>
          <div className="flex gap-6 items-start">
            {arc.coverImage && (
              <img
                src={arc.coverImage || "/placeholder.svg"}
                alt={arc.displayName}
                className="w-24 h-32 object-cover rounded-lg shadow-lg"
              />
            )}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-foreground">{arc.displayName}</h1>
              {arc.description && <p className="text-muted-foreground mt-2">{arc.description}</p>}
              <p className="text-sm text-muted-foreground mt-2">{episodes.length} episodes</p>
            </div>
          </div>
        </div>
      </div>

      {/* Episodes Grid */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold mb-6">Episodes</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {episodes.map((episode, index) => (
            <motion.div
              key={episode.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                className="cursor-pointer hover:shadow-lg transition-all group overflow-hidden"
                onClick={() => router.push(`/player?arc=${slug}&episode=${episode.order}`)}
              >
                <div className="aspect-video bg-muted relative overflow-hidden">
                  {episode.thumbnail ? (
                    <img
                      src={episode.thumbnail || "/placeholder.svg"}
                      alt={episode.displayName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
                      <div className="text-center">
                        <div className="text-3xl mb-2">▶</div>
                        <p className="text-xs text-muted-foreground">No thumbnail</p>
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center cursor-pointer">
                        <div className="text-white text-lg">▶</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-foreground text-sm flex-1">{episode.displayName}</h3>
                    {episode.episodeNumber && (
                      <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded whitespace-nowrap">
                        Ep {episode.episodeNumber}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{episode.fileName}</p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </main>
  )
}
