import IntentPanel from '../components/IntentPanel'
import KvpEngine from '../components/KvpEngine'
import NeuroLattice from '../components/NeuroLattice'
import SystemStrip from '../components/SystemStrip'
import TelemetryPanel from '../components/TelemetryPanel'
import TraceLedger from '../components/TraceLedger'

export default function ConsoleView({
  engineState,
  latency,
  cpu,
  memory,
  series,
  logs,
  confidence,
  intent,
  telemetry,
  onCommand,
  onEngineToggle,
}) {
  return (
    <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_370px] 2xl:grid-cols-[minmax(0,1fr)_404px]">
      <section className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-3">
        <div className="depth-2 order-1">
          <KvpEngine
            engineState={engineState}
            onToggle={onEngineToggle}
            latency={latency}
            confidence={confidence}
          />
        </div>
        <div className="depth-2 order-2">
          <NeuroLattice engineState={engineState} telemetry={telemetry} onCommand={onCommand} />
        </div>
        <div className="depth-1 order-4">
          <SystemStrip latency={latency} evidenceCount={14} engineState={engineState} />
        </div>
        <div className="depth-1 order-6 xl:flex xl:flex-1 xl:flex-col">
          <TraceLedger onCommand={onCommand} />
        </div>
      </section>

      <aside className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-3">
        <div className="depth-1 order-3">
          <TelemetryPanel
            series={series}
            logs={logs}
            latency={latency}
            cpu={cpu}
            memory={memory}
          />
        </div>
        <div className="depth-1 order-5 xl:flex xl:flex-1 xl:flex-col">
          <IntentPanel engineState={engineState} intent={intent} onCommand={onCommand} />
        </div>
      </aside>
    </div>
  )
}
