import { useCallback, useEffect, useRef, useState } from 'react'
import Background from './components/Background'
import IconRail from './components/IconRail'
import IntentPanel from './components/IntentPanel'
import KvpEngine from './components/KvpEngine'
import SpatialFrame from './components/SpatialFrame'
import StatusFooter from './components/StatusFooter'
import SystemStrip from './components/SystemStrip'
import TelemetryPanel from './components/TelemetryPanel'
import TraceLedger from './components/TraceLedger'
import TopBar from './components/TopBar'

const INITIAL_SERIES = [28, 32, 30, 36, 41, 38, 44, 47, 43, 49, 54, 51, 58, 55, 61, 59, 64, 62, 68, 66, 71, 69, 74, 72]

const ACTIVE_MESSAGES = [
  'Tool route resolved: workspace.scan -> local bus.',
  'Plan checkpoint sealed to evidence ledger.',
  'Operator preview accepted. Execution window open.',
  'Local context diff captured: 14 files, 0 remote calls.',
  'Safety interlock revalidated. No drift detected.',
]

function stamp(offsetSeconds = 0) {
  return new Date(Date.now() - offsetSeconds * 1000).toLocaleTimeString('en-GB', { hour12: false })
}

function makeInitialLogs() {
  return [
    { id: 1, time: stamp(24), tag: 'SYS', tone: 'mint', message: 'KVP core initialized on local contour.' },
    { id: 2, time: stamp(19), tag: 'NET', tone: 'ice', message: 'Remote route observed. Standby, no traffic.' },
    { id: 3, time: stamp(14), tag: 'MEM', tone: 'muted', message: 'Workspace index loaded. 124 objects mapped.' },
    { id: 4, time: stamp(9), tag: 'SAFE', tone: 'mint', message: 'Safety interlock armed. Human gate required.' },
    { id: 5, time: stamp(4), tag: 'EVD', tone: 'ice', message: 'Evidence anchor verified: 9f2c:7a41:e41a.' },
  ]
}

export default function App() {
  const [now, setNow] = useState(() => new Date())
  const [engineState, setEngineState] = useState('IDLE')
  const [series, setSeries] = useState(INITIAL_SERIES)
  const [logs, setLogs] = useState(makeInitialLogs)
  const [latency, setLatency] = useState(18)
  const [cpu, setCpu] = useState(37)
  const [memory, setMemory] = useState(62)
  const [confidence, setConfidence] = useState(97.4)
  const [intent, setIntent] = useState(
    'Route local context to the KVP core and stage a safe execution plan.',
  )

  const stageRef = useRef(null)
  const bootTimer = useRef(null)
  const nextLogId = useRef(10)

  const pushLog = useCallback((tag, message, tone = 'muted') => {
    const id = nextLogId.current++
    setLogs((previous) => [
      ...previous.slice(-7),
      { id, time: stamp(), tag, tone, message },
    ])
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setSeries((previous) => {
        const last = previous[previous.length - 1]
        const delta = Math.round((Math.random() - 0.44) * 9)
        const next = Math.min(92, Math.max(26, last + delta))
        return [...previous.slice(1), next]
      })

      setLatency((previous) => {
        const next = previous + Math.round((Math.random() - 0.5) * 4)
        return Math.min(34, Math.max(11, next))
      })

      setCpu((previous) => {
        const next = previous + Math.round((Math.random() - 0.5) * 6)
        return Math.min(62, Math.max(21, next))
      })

      setMemory((previous) => {
        const next = previous + Math.round((Math.random() - 0.5) * 3)
        return Math.min(78, Math.max(48, next))
      })

      setConfidence((previous) => {
        const next = previous + (Math.random() - 0.5) * 0.4
        return Math.min(99.4, Math.max(94.2, next))
      })
    }, 2200)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (engineState !== 'ACTIVE') return undefined

    const timer = setInterval(() => {
      const message = ACTIVE_MESSAGES[Math.floor(Math.random() * ACTIVE_MESSAGES.length)]
      pushLog('KVP', message, 'mint')
    }, 4600)

    return () => clearInterval(timer)
  }, [engineState, pushLog])

  useEffect(() => {
    return () => {
      if (bootTimer.current) clearTimeout(bootTimer.current)
    }
  }, [])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return undefined

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const finePointer = window.matchMedia('(pointer: fine)').matches
    if (reducedMotion || !finePointer) return undefined

    let frame = 0

    const handleMove = (event) => {
      const pointerX = event.clientX
      const pointerY = event.clientY
      if (frame) return

      frame = requestAnimationFrame(() => {
        const x = pointerX / window.innerWidth - 0.5
        const y = pointerY / window.innerHeight - 0.5
        stage.style.setProperty('--ry', `${x * 4}deg`)
        stage.style.setProperty('--rx', `${y * -3}deg`)
        frame = 0
      })
    }

    const resetTilt = () => {
      stage.style.setProperty('--ry', '0deg')
      stage.style.setProperty('--rx', '0deg')
    }

    window.addEventListener('pointermove', handleMove, { passive: true })
    window.addEventListener('pointerleave', resetTilt)

    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerleave', resetTilt)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  const handleCommand = useCallback(
    (command) => {
      setIntent(command)
      pushLog('CMD', `Intent staged: ${command}`, 'ice')
    },
    [pushLog],
  )

  const handleEngineToggle = useCallback(() => {
    if (engineState === 'BOOTING') return

    if (engineState === 'IDLE') {
      setEngineState('BOOTING')
      pushLog('AUTH', 'Operator authorization accepted. Calibrating core.', 'amber')

      bootTimer.current = setTimeout(() => {
        setEngineState('ACTIVE')
        pushLog('KVP', 'Core engaged. Local execution contour is live.', 'mint')
      }, 1800)
      return
    }

    setEngineState('IDLE')
    pushLog('SYS', 'Control released. Core returned to standby.', 'ice')
  }, [engineState, pushLog])

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <Background />
      <SpatialFrame />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1760px] flex-col gap-3 p-3 sm:p-4 xl:flex-row xl:gap-4 xl:p-5">
        <IconRail />

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <TopBar now={now} engineState={engineState} />

          <main
            ref={stageRef}
            className="ar-stage mt-1 grid min-w-0 flex-1 gap-3 pb-14 xl:pb-8 xl:grid-cols-[minmax(0,1fr)_370px] 2xl:grid-cols-[minmax(0,1fr)_404px]"
          >
            <section className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-3">
              <div className="depth-2 order-1">
                <KvpEngine
                  engineState={engineState}
                  onToggle={handleEngineToggle}
                  latency={latency}
                  confidence={confidence}
                />
              </div>
              <div className="depth-1 order-3">
                <SystemStrip latency={latency} evidenceCount={14} engineState={engineState} />
              </div>
              <div className="depth-1 order-5 xl:flex xl:flex-1 xl:flex-col">
                <TraceLedger onCommand={handleCommand} />
              </div>
            </section>

            <aside className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-3">
              <div className="depth-1 order-2">
                <TelemetryPanel
                  series={series}
                  logs={logs}
                  latency={latency}
                  cpu={cpu}
                  memory={memory}
                />
              </div>
              <div className="depth-1 order-4 xl:flex xl:flex-1 xl:flex-col">
                <IntentPanel engineState={engineState} intent={intent} onCommand={handleCommand} />
              </div>
            </aside>
          </main>

          <StatusFooter engineState={engineState} latency={latency} />
        </div>
      </div>
    </div>
  )
}
