import ProvenanceTimeline from '../components/ProvenanceTimeline'
import SystemStrip from '../components/SystemStrip'
import TraceLedger from '../components/TraceLedger'

export default function EvidenceView({ engineState, latency, onCommand }) {
  return (
    <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)] xl:items-start">
      <div className="depth-2 flex min-w-0 flex-col">
        <ProvenanceTimeline evidenceCount={14} />
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <div className="depth-1">
          <SystemStrip latency={latency} evidenceCount={14} engineState={engineState} />
        </div>
        <div className="depth-1 flex min-w-0 flex-1 flex-col">
          <TraceLedger onCommand={onCommand} />
        </div>
      </div>
    </div>
  )
}
