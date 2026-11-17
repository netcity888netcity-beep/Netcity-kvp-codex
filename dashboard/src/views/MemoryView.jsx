import MemoryMap from '../components/MemoryMap'
import SystemStrip from '../components/SystemStrip'

export default function MemoryView({ engineState, latency, onCommand }) {
  return (
    <>
      <div className="depth-2 flex min-w-0 flex-1 flex-col">
        <MemoryMap engineState={engineState} onCommand={onCommand} />
      </div>
      <div className="depth-1">
        <SystemStrip latency={latency} evidenceCount={14} engineState={engineState} />
      </div>
    </>
  )
}
