import { useEffect, useRef, useState } from 'react'

/**
 * Smooth countdown driven by the SERVER's remaining_seconds.
 * `sync(seconds)` re-anchors the clock (called on load and after every heartbeat),
 * so the browser clock can never extend the exam. performance.now() is used so that
 * changing the computer's date/time has no effect.
 */
export default function useCountdown(onExpire) {
  const [remaining, setRemaining] = useState(null)
  const deadline = useRef(null)
  const fired = useRef(false)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  const sync = (seconds) => {
    deadline.current = performance.now() + seconds * 1000
    if (seconds > 0) fired.current = false
    setRemaining(Math.max(0, Math.ceil(seconds)))
  }

  useEffect(() => {
    const t = setInterval(() => {
      if (deadline.current == null) return
      const left = Math.max(0, Math.ceil((deadline.current - performance.now()) / 1000))
      setRemaining(left)
      if (left === 0 && !fired.current) {
        fired.current = true
        onExpireRef.current?.()
      }
    }, 250)
    return () => clearInterval(t)
  }, [])

  return { remaining, sync }
}
