"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { exportMetadata, importMetadata } from "@/lib/db"
import { motion } from "framer-motion"
import Link from "next/link"
import { Moon, Sun } from "lucide-react"

export default function SettingsPage() {
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [theme, setTheme] = useState<"light" | "dark">("light")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const savedTheme = (localStorage.getItem("theme") as "light" | "dark") || "light"
    setTheme(savedTheme)
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light"
    setTheme(newTheme)
    const html = document.documentElement
    if (newTheme === "dark") {
      html.classList.add("dark")
    } else {
      html.classList.remove("dark")
    }
    localStorage.setItem("theme", newTheme)
  }

  async function handleExport() {
    setExporting(true)
    setMessage(null)
    try {
      const data = await exportMetadata()
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `one-piece-backup-${new Date().toISOString().split("T")[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      setMessage({ type: "success", text: "Metadata exported successfully!" })
    } catch (error) {
      console.error("Export error:", error)
      setMessage({ type: "error", text: "Failed to export metadata" })
    } finally {
      setExporting(false)
    }
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setImporting(true)
    setMessage(null)
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      await importMetadata(data)
      setMessage({ type: "success", text: "Metadata imported successfully! Please refresh the page." })
    } catch (error) {
      console.error("Import error:", error)
      setMessage({ type: "error", text: "Failed to import metadata. Invalid file format." })
    } finally {
      setImporting(false)
    }
  }

  if (!mounted) return null

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <Link href="/">
            <Button variant="ghost" className="mb-4 cursor-pointer">
              ← Back
            </Button>
          </Link>
          <h1 className="text-4xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-2">Manage your One Piece Viewer preferences</p>
        </div>
      </div>

      {/* Settings Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Message Alert */}
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-6 p-4 rounded-lg ${
              message.type === "success"
                ? "bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20"
                : "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20"
            }`}
          >
            {message.text}
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Card className="p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">Appearance</h2>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground mb-1">Theme</h3>
                <p className="text-sm text-muted-foreground">Choose between light and dark theme</p>
              </div>
              <button
                onClick={toggleTheme}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors cursor-pointer"
                aria-label="Toggle theme"
              >
                {theme === "light" ? (
                  <>
                    <Moon className="w-5 h-5" />
                    <span className="text-sm font-medium">Dark</span>
                  </>
                ) : (
                  <>
                    <Sun className="w-5 h-5" />
                    <span className="text-sm font-medium">Light</span>
                  </>
                )}
              </button>
            </div>
          </Card>
        </motion.div>

        {/* Privacy Notice */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Card className="p-6 bg-blue-500/5 border-blue-500/20">
            <h2 className="text-lg font-bold text-foreground mb-2">Privacy Notice</h2>
            <p className="text-muted-foreground">
              All files stay on your machine. No data is uploaded to any remote server. Your episodes, metadata, and
              watch progress are stored locally in your browser's IndexedDB.
            </p>
          </Card>
        </motion.div>

        {/* Backup & Restore */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-6"
        >
          <Card className="p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">Backup & Restore</h2>
            <p className="text-muted-foreground mb-6">
              Export your arc metadata, episode information, and watch progress as a JSON file. You can import this file
              later to restore your data.
            </p>

            <div className="space-y-4">
              {/* Export */}
              <div>
                <h3 className="font-semibold text-foreground mb-2">Export Metadata</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Download a backup of all your arcs, episodes, and watch progress.
                </p>
                <Button onClick={handleExport} disabled={exporting} className="w-full sm:w-auto cursor-pointer">
                  {exporting ? "Exporting..." : "Export Metadata"}
                </Button>
              </div>

              {/* Import */}
              <div className="border-t border-border pt-4">
                <h3 className="font-semibold text-foreground mb-2">Import Metadata</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Restore your data from a previously exported JSON file.
                </p>
                <label>
                  <input type="file" accept=".json" onChange={handleImport} disabled={importing} className="hidden" />
                  <Button asChild disabled={importing} className="w-full sm:w-auto cursor-pointer">
                    <span>{importing ? "Importing..." : "Import Metadata"}</span>
                  </Button>
                </label>
              </div>
            </div>
          </Card>

          {/* About */}
          <Card className="p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">About</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">One Piece Viewer</strong> is a local episode manager built with
                Next.js and Tailwind CSS.
              </p>
              <p>
                <strong className="text-foreground">Features:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Local file system access via File System Access API</li>
                <li>Auto-discovery of arcs and episodes</li>
                <li>HTML5 video player with keyboard shortcuts</li>
                <li>Automatic resume playback</li>
                <li>Thumbnail extraction and caching</li>
                <li>IndexedDB for metadata storage</li>
                <li>Export/Import functionality</li>
              </ul>
              <p className="pt-2">
                <strong className="text-foreground">Keyboard Shortcuts:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Space: Play/Pause</li>
                <li>Arrow Left / J: Rewind 10s</li>
                <li>Arrow Right / L: Forward 10s</li>
                <li>F: Fullscreen</li>
              </ul>
            </div>
          </Card>
        </motion.div>
      </div>
    </main>
  )
}
