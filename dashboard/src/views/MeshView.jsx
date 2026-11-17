import AgentMesh from '../components/AgentMesh'
import SystemStrip from '../components/SystemStrip'
import TelemetryPanel from '../components/TelemetryPanel'

export default function MeshView({ engineState, latency, cpu, memory, series, logs, telemetry, onCommand }) {
  return (
    <>
      <div className="depth-2">
        <AgentMesh engineState={engineState} telemetry={telemetry} onCommand={onCommand} />
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
