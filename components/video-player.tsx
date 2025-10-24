"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Volume2, VolumeX, Maximize, Play, Pause, SkipBack, SkipForward } from "lucide-react"

interface VideoPlayerProps {
  src: string
  onTimeUpdate: (currentTime: number) => void
  onEnded: () => void
  onPlaybackStateChange?: (isPlaying: boolean) => void
  autoPlay?: boolean
  resumeTime?: number
  onResumeClick?: () => void
  autoPlayNext?: boolean
  onAutoPlayNextChange?: (enabled: boolean) => void
}

export function VideoPlayer({
  src,
  onTimeUpdate,
  onEnded,
  onPlaybackStateChange,
  autoPlay = true,
  resumeTime,
  onResumeClick,
  autoPlayNext = false,
  onAutoPlayNextChange,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const progressBarRef = useRef<HTMLInputElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isBuffering, setIsBuffering] = useState(false)
  const [hoverTime, setHoverTime] = useState<number | null>(null)
  const [hoverX, setHoverX] = useState(0)
  const hideControlsTimeout = useRef<NodeJS.Timeout>()
  const timeUpdateTimeout = useRef<NodeJS.Timeout>()
  const [hasResumed, setHasResumed] = useState(false)

  const handleMouseMove = () => {
    setShowControls(true)
    if (hideControlsTimeout.current) clearTimeout(hideControlsTimeout.current)
    if (isPlaying) {
      hideControlsTimeout.current = setTimeout(() => setShowControls(false), 3000)
    }
  }

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play()
      } else {
        videoRef.current.pause()
      }
    }
  }

  const handleRewind = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10)
    }
  }

  const handleForward = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(videoRef.current.duration, videoRef.current.currentTime + 10)
    }
  }

  const handleMute = () => {
    if (videoRef.current) {
      setIsMuted(!isMuted)
      videoRef.current.muted = !isMuted
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number.parseFloat(e.target.value)
    setVolume(newVolume)
    if (videoRef.current) {
      videoRef.current.volume = newVolume
      if (newVolume > 0 && isMuted) setIsMuted(false)
    }
  }

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number.parseFloat(e.target.value)
    if (videoRef.current) {
      videoRef.current.currentTime = newTime
    }
  }

  const handleProgressHover = (e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>) => {
    if (!progressBarRef.current || !duration) return

    const rect = progressBarRef.current.getBoundingClientRect()
    let clientX: number

    if ("touches" in e) {
      clientX = e.touches[0].clientX
    } else {
      clientX = e.clientX
    }

    const x = clientX - rect.left
    const percentage = Math.max(0, Math.min(1, x / rect.width))
    const time = percentage * duration

    setHoverTime(time)
    setHoverX(x)
  }

  const handleProgressLeave = () => {
    setHoverTime(null)
  }

  const handleFullscreen = () => {
    if (containerRef.current) {
      if (!isFullscreen) {
        containerRef.current.requestFullscreen()
      } else {
        document.exitFullscreen()
      }
    }
  }

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds)) return "0:00"
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`
  }

  useEffect(() => {
    const video = videoRef.current
    if (!video || !resumeTime || hasResumed) return

    const handleLoadedMetadata = () => {
      video.currentTime = resumeTime
      setCurrentTime(resumeTime)
      setHasResumed(true)
    }

    if (video.readyState >= 1) {
      video.currentTime = resumeTime
      setCurrentTime(resumeTime)
      setHasResumed(true)
    } else {
      video.addEventListener("loadedmetadata", handleLoadedMetadata)
      return () => video.removeEventListener("loadedmetadata", handleLoadedMetadata)
    }
  }, [resumeTime, hasResumed])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!videoRef.current) return

      switch (e.key.toLowerCase()) {
        case " ":
          e.preventDefault()
          handlePlayPause()
          break
        case "arrowleft":
        case "j":
          e.preventDefault()
          handleRewind()
          break
        case "arrowright":
        case "l":
          e.preventDefault()
          handleForward()
          break
        case "f":
          e.preventDefault()
          handleFullscreen()
          break
        case "m":
          e.preventDefault()
          handleMute()
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isPlaying, isFullscreen, isMuted])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handlePlay = () => {
      setIsPlaying(true)
      onPlaybackStateChange?.(true)
      setShowControls(false)
    }
    const handlePause = () => {
      setIsPlaying(false)
      onPlaybackStateChange?.(false)
      setShowControls(true)
      onTimeUpdate(video.currentTime)
    }
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
      if (timeUpdateTimeout.current) clearTimeout(timeUpdateTimeout.current)
      timeUpdateTimeout.current = setTimeout(() => {
        onTimeUpdate(video.currentTime)
      }, 1000)
    }
    const handleLoadedMetadata = () => {
      setDuration(video.duration)
    }
    const handleEnded = () => {
      setIsPlaying(false)
      onEnded()
    }
    const handleWaiting = () => setIsBuffering(true)
    const handleCanPlay = () => setIsBuffering(false)
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    video.addEventListener("play", handlePlay)
    video.addEventListener("pause", handlePause)
    video.addEventListener("timeupdate", handleTimeUpdate)
    video.addEventListener("loadedmetadata", handleLoadedMetadata)
    video.addEventListener("ended", handleEnded)
    video.addEventListener("waiting", handleWaiting)
    video.addEventListener("canplay", handleCanPlay)
    document.addEventListener("fullscreenchange", handleFullscreenChange)

    const handleVisibilityChange = () => {
      if (document.hidden) {
        onTimeUpdate(video.currentTime)
      }
    }
    const handleBeforeUnload = () => {
      onTimeUpdate(video.currentTime)
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("beforeunload", handleBeforeUnload)

    if (autoPlay) {
      video.play().catch(() => {
        console.log("[v0] Autoplay blocked by browser")
      })
    }

    return () => {
      video.removeEventListener("play", handlePlay)
      video.removeEventListener("pause", handlePause)
      video.removeEventListener("timeupdate", handleTimeUpdate)
      video.removeEventListener("loadedmetadata", handleLoadedMetadata)
      video.removeEventListener("ended", handleEnded)
      video.removeEventListener("waiting", handleWaiting)
      video.removeEventListener("canplay", handleCanPlay)
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("beforeunload", handleBeforeUnload)
      if (timeUpdateTimeout.current) clearTimeout(timeUpdateTimeout.current)
    }
  }, [onTimeUpdate, onEnded, onPlaybackStateChange, autoPlay])

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-black aspect-video group cursor-pointer"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video ref={videoRef} src={src} className="w-full h-full" crossOrigin="anonymous" />

      <AnimatePresence>
        {!isPlaying && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 gap-4"
            onClick={handlePlayPause}
          >
            {resumeTime && resumeTime > 5 && !hasResumed && (
              <motion.button
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                onClick={(e) => {
                  e.stopPropagation()
                  onResumeClick?.()
                }}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
              >
                Resume at {formatTime(resumeTime)}
              </motion.button>
            )}
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              className="w-20 h-20 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-colors cursor-pointer"
            >
              <Play className="w-8 h-8 text-black fill-black ml-1" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 space-y-2"
          >
            {/* Progress bar with hover preview */}
            <div className="relative group">
              <input
                ref={progressBarRef}
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleProgressChange}
                onMouseMove={handleProgressHover}
                onTouchMove={handleProgressHover}
                onMouseLeave={handleProgressLeave}
                onTouchEnd={handleProgressLeave}
                className="w-full h-1 bg-white/30 rounded cursor-pointer accent-primary hover:h-2 transition-all"
                aria-label="Video progress"
              />

              <AnimatePresence>
                {hoverTime !== null && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-full left-0 mb-2 pointer-events-none"
                    style={{
                      transform: `translateX(calc(${hoverX}px - 50%))`,
                    }}
                  >
                    <div className="bg-black/90 text-white text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                      {formatTime(hoverTime)}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Time display and controls */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {/* Play/Pause */}
                <button
                  onClick={handlePlayPause}
                  className="p-2 hover:bg-white/20 rounded transition-colors cursor-pointer"
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 text-white" />
                  ) : (
                    <Play className="w-5 h-5 text-white fill-white" />
                  )}
                </button>

                {/* Rewind 10s */}
                <button
                  onClick={handleRewind}
                  className="p-2 hover:bg-white/20 rounded transition-colors cursor-pointer"
                  aria-label="Rewind 10 seconds"
                >
                  <SkipBack className="w-5 h-5 text-white" />
                </button>

                {/* Forward 10s */}
                <button
                  onClick={handleForward}
                  className="p-2 hover:bg-white/20 rounded transition-colors cursor-pointer"
                  aria-label="Forward 10 seconds"
                >
                  <SkipForward className="w-5 h-5 text-white" />
                </button>

                {/* Volume */}
                <div className="flex items-center gap-2 ml-2">
                  <button
                    onClick={handleMute}
                    className="p-2 hover:bg-white/20 rounded transition-colors cursor-pointer"
                    aria-label={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-20 h-1 bg-white/30 rounded cursor-pointer accent-primary"
                    aria-label="Volume"
                  />
                </div>

                {/* Time display */}
                <div className="text-white text-sm ml-auto">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Styled Auto-play Next Toggle */}
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={autoPlayNext}
                      onChange={(e) => onAutoPlayNextChange?.(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-gray-300 rounded-full peer-checked:bg-blue-600 transition-colors duration-200"></div>
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-200 peer-checked:translate-x-5"></div>
                  </div>
                  <span className="text-white">Auto-play next</span>
                </label>

                {/* Fullscreen */}
                <button
                  onClick={handleFullscreen}
                  className="p-2 hover:bg-white/20 rounded transition-colors cursor-pointer"
                  aria-label="Fullscreen"
                >
                  <Maximize className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Buffering indicator */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
