import { useCallback, useEffect, useRef, useState } from 'react'
import { getErrorMessage } from '../services/api'

/**
 * Calls `fetcher` immediately and then every `interval` ms (near-real-time monitoring).
 * Re-runs when `deps` change. Ignores out-of-order responses.
 */
export default function usePolling(fetcher, { interval = 5000, enabled = true, deps = [] } = {}) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState(null)
  const fetcherRef = useRef(fetcher)
  const reqId = useRef(0)
  fetcherRef.current = fetcher

  const run = useCallback(async () => {
    const id = ++reqId.current
    try {
      const result = await fetcherRef.current()
      if (id !== reqId.current) return
      setData(result)
      setError(null)
      setUpdatedAt(Date.now())
    } catch (e) {
      if (id !== reqId.current) return
      setError(getErrorMessage(e))
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return undefined
    setLoading(true)
    run()
    const t = setInterval(run, interval)
    return () => { clearInterval(t); reqId.current++ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, interval, run, ...deps])

  return { data, error, loading, updatedAt, refresh: run, setData }
}
