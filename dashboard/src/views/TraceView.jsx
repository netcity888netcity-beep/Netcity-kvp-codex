import SystemStrip from '../components/SystemStrip'
import TelemetryPanel from '../components/TelemetryPanel'
import TraceLedger from '../components/TraceLedger'

export default function TraceView({ engineState, latency, cpu, memory, series, logs, onCommand }) {
  return (
    <>
      <div className="depth-2 flex min-w-0 flex-1 flex-col">
        <TraceLedger onCommand={onCommand} />
      </div>
      <div className="grid min-w-0 gap-3 lg:grid-cols-2">
        <div className="depth-1 flex min-w-0 flex-col">
          <TelemetryPanel series={series} logs={logs} latency={latency} cpu={cpu} memory={memory} />
        </div>
        <div className="depth-1 flex min-w-0 flex-col gap-3">
          <SystemStrip latency={latency} evidenceCount={14} engineState={engineState} />
        </div>
      </div>
    </>
  )
}
