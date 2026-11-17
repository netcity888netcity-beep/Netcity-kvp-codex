import NeuroLattice from '../components/NeuroLattice'
import PulseTimeline from '../components/PulseTimeline'
import QuantumState from '../components/QuantumState'

export default function LatticeView({ engineState, telemetry, onCommand }) {
  return (
    <>
      <div className="depth-2">
        <NeuroLattice engineState={engineState} telemetry={telemetry} onCommand={onCommand} />
      </div>
      <div className="grid min-w-0 gap-3 lg:grid-cols-2">
        <div className="depth-1 flex min-w-0 flex-col">
          <QuantumState engineState={engineState} telemetry={telemetry} onCommand={onCommand} />
        </div>
        <div className="depth-1 flex min-w-0 flex-col">
          <PulseTimeline engineState={engineState} telemetry={telemetry} onCommand={onCommand} />
        </div>
      </div>
    </>
  )
}
