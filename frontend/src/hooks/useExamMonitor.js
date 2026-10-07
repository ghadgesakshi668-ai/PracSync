import { useCallback, useEffect, useRef } from 'react'
import * as studentApi from '../services/student'

const HEARTBEAT_MS = 15000
const DIALOG_WINDOW_MS = 45000

/**
 * Browser-level activity monitoring for the exam page.
 *
 * What the browser CAN tell us: tab visibility, window focus, copy / paste events, coarse activity.
 * What it CANNOT: what other applications are open or being used (needs a lockdown browser / desktop agent).
 *
 * Every event is POSTed to the backend, which stores it and recomputes the anomaly score.
 * Failed network calls are queued and retried so a brief outage does not lose events.
 */
export default function useExamMonitor({ examId, enabled, onResponse, onLocalEvent }) {
  const queue = useRef([])
  const flushing = useRef(false)
  const interactions = useRef(0)
  const dialogOpenedAt = useRef(0)
  const suppressed = useRef(false)
  const cbs = useRef({})
  cbs.current = { onResponse, onLocalEvent }

  const inDialog = () => dialogOpenedAt.current && Date.now() - dialogOpenedAt.current < DIALOG_WINDOW_MS

  const flush = useCallback(async () => {
    if (flushing.current) return
    flushing.current = true
    try {
      while (queue.current.length) {
        const item = queue.current[0]
        try {
          const res = await studentApi.postActivity(examId, item.type, item.data)
          queue.current.shift()
          cbs.current.onResponse?.(res)
        } catch (err) {
          if (!err.response) break          // network problem: keep the event, retry on the next flush
          queue.current.shift()             // server rejected it: drop it
        }
      }
    } finally {
      flushing.current = false
    }
  }, [examId])

  const send = useCallback((type, data = {}) => {
    if (suppressed.current) return
    const payload = { ...data, client_ts: new Date().toISOString() }
    queue.current.push({ type, data: payload })
    if (type !== 'HEARTBEAT') cbs.current.onLocalEvent?.(type, payload)
    flush()
  }, [flush])

  useEffect(() => {
    if (!enabled) return undefined
    let hiddenAt = null
    let blurLogged = false
    const ctx = () => (inDialog() ? { context: 'file_dialog' } : {})

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
        send('TAB_SWITCH', { visibility: 'hidden', ...ctx() })
      } else {
        const away = hiddenAt ? Math.round((Date.now() - hiddenAt) / 1000) : null
        hiddenAt = null
        send('VISIBILITY_CHANGE', { visibility: 'visible', away_seconds: away, ...ctx() })
      }
    }
    // A real tab switch also fires `blur`. We wait briefly and only log WINDOW_BLUR when the page is
    // still visible (e.g. the user clicked another window), so one tab switch is never counted twice.
    const onBlur = () => {
      setTimeout(() => {
        if (!document.hidden && !document.hasFocus()) {
          blurLogged = true
          send('WINDOW_BLUR', ctx())
        }
      }, 200)
    }
    const onFocus = () => {
      if (blurLogged) { blurLogged = false; send('WINDOW_FOCUS', ctx()) }
      // Coming back from the file picker (even if it was cancelled) ends the "benign" window.
      if (dialogOpenedAt.current) setTimeout(() => { dialogOpenedAt.current = 0 }, 600)
    }
    const onCopy = (e) => send('COPY_ATTEMPT', { action: e.type })
    const onPaste = (e) => {
      let chars = null
      try { chars = (e.clipboardData?.getData('text') || '').length } catch { /* ignore */ }
      send('PASTE_ATTEMPT', { chars })
    }
    const bump = () => { interactions.current += 1 }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    document.addEventListener('copy', onCopy)
    document.addEventListener('cut', onCopy)
    document.addEventListener('paste', onPaste)
    window.addEventListener('keydown', bump)
    window.addEventListener('pointerdown', bump)
    window.addEventListener('mousemove', bump, { passive: true })

    const beat = () => {
      send('HEARTBEAT', {
        interactions: interactions.current,
        visible: !document.hidden,
        focused: document.hasFocus(),
      })
      interactions.current = 0
    }
    beat()
    const timer = setInterval(beat, HEARTBEAT_MS)

    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('cut', onCopy)
      document.removeEventListener('paste', onPaste)
      window.removeEventListener('keydown', bump)
      window.removeEventListener('pointerdown', bump)
      window.removeEventListener('mousemove', bump)
    }
  }, [enabled, send])

  return {
    /** Call right before opening the OS file picker: focus loss caused by it is recorded but not scored. */
    beginFileDialog: () => { dialogOpenedAt.current = Date.now() },
    endFileDialog: () => { setTimeout(() => { dialogOpenedAt.current = 0 }, 600) },
    /** Stop recording while the final submission request is in flight. */
    setSubmitting: (v) => { suppressed.current = v },
  }
}
