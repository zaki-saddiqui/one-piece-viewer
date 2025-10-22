// Custom hooks for the app
"use client"

import { useEffect, useState, useCallback } from "react"

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(initialValue)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    try {
      const item = typeof window !== "undefined" ? window.localStorage.getItem(key) : null
      if (item) {
        setStoredValue(JSON.parse(item))
      }
    } catch (error) {
      console.error("Error reading from localStorage:", error)
    }
    setIsLoaded(true)
  }, [key])

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value
        setStoredValue(valueToStore)
        if (typeof window !== "undefined") {
          window.localStorage.setItem(key, JSON.stringify(valueToStore))
        }
      } catch (error) {
        console.error("Error writing to localStorage:", error)
      }
    },
    [key, storedValue],
  )

  return [storedValue, setValue, isLoaded] as const
}
