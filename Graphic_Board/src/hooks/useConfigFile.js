import { useState, useEffect, useCallback, useRef } from 'react'
import { readConfig, writeConfig, migrateFromLocalStorage } from '../utils/configFile.js'

const DEBOUNCE_MS = 800

export function useConfigFile(rootHandle) {
  const [config, setConfig] = useState(null)
  const latestRef = useRef(null)
  const rootRef   = useRef(rootHandle)
  const timerRef  = useRef(null)

  useEffect(() => { rootRef.current = rootHandle }, [rootHandle])

  useEffect(() => {
    if (!rootHandle) { setConfig(null); latestRef.current = null; return }

    readConfig(rootHandle).then(existing => {
      const data = existing ?? migrateFromLocalStorage()
      latestRef.current = data
      setConfig(data)
      if (!existing) writeConfig(rootHandle, data)
    })
  }, [rootHandle])

  const updateConfig = useCallback((patch) => {
    const next = { ...latestRef.current, ...patch }
    latestRef.current = next
    setConfig(next)

    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (rootRef.current) writeConfig(rootRef.current, latestRef.current)
    }, DEBOUNCE_MS)
  }, [])

  return { config, configReady: config !== null, updateConfig }
}
