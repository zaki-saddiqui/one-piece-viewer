"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ChevronDown, ChevronUp, Edit2, Save, X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import type { EpisodeDescription } from "@/lib/db"

interface EpisodeDescriptionProps {
  description: EpisodeDescription | null
  isLoading: boolean
  onSave: (text: string, saveToFile: boolean) => Promise<void>
}

export function EpisodeDescriptionComponent({ description, isLoading, onSave }: EpisodeDescriptionProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (description?.text) {
      setEditText(description.text)
    }
  }, [description])

  const hasDescription = description && description.text.trim().length > 0
  const displayText = description?.text || ""
  const isLongText = displayText.length > 2000
  const previewText = isLongText && !isExpanded ? displayText.substring(0, 2000) : displayText

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const handleSave = async (saveToFile: boolean) => {
    setIsSaving(true)
    setError(null)
    try {
      await onSave(editText, saveToFile)
      setIsEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save description")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <Card className="p-4 mt-6 bg-card">
        <div className="text-muted-foreground text-sm">Loading description...</div>
      </Card>
    )
  }

  return (
    <Card className="p-4 mt-6 bg-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-foreground">Episode Description</h3>
        {hasDescription && !isEditing && (
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} className="text-xs">
            <Edit2 className="w-4 h-4 mr-1" />
            Edit
          </Button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {isEditing ? (
          <motion.div
            key="edit"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full h-32 p-3 bg-background border border-border rounded-md text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Add episode description..."
            />
            {error && <div className="text-xs text-destructive">{error}</div>}
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleSave(false)} disabled={isSaving} className="flex-1">
                <Save className="w-4 h-4 mr-1" />
                {isSaving ? "Saving..." : "Save to App"}
              </Button>
              {description?.source === "disk" && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleSave(true)}
                  disabled={isSaving}
                  className="flex-1"
                >
                  Save to Disk
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsEditing(false)
                  setEditText(description?.text || "")
                  setError(null)
                }}
                disabled={isSaving}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        ) : hasDescription ? (
          <motion.div
            key="view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <div className="text-sm text-foreground whitespace-pre-wrap break-words">
              {previewText}
              {isLongText && !isExpanded && "..."}
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Source: {description.source} • last updated: {formatDate(description.lastUpdated)}
              </div>
              {isLongText && (
                <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)} className="text-xs">
                  {isExpanded ? (
                    <>
                      <ChevronUp className="w-4 h-4 mr-1" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4 mr-1" />
                      Show more
                    </>
                  )}
                </Button>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-sm text-muted-foreground"
          >
            <p>No description — add one</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsEditing(true)
                setEditText("")
              }}
              className="mt-2 text-xs"
            >
              <Edit2 className="w-4 h-4 mr-1" />
              Add Description
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}
