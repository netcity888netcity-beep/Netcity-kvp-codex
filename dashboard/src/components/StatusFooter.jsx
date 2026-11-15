import { Cpu, Radio, ShieldCheck } from 'lucide-react'

export default function StatusFooter({ engineState, latency }) {
  return (
    <footer className="flex flex-col gap-1.5 border-t border-line/40 px-1 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <span className="flex items-center gap-1.5 font-mono text-[7px] tracking-[0.14em] text-dim">
        <Cpu size={9} />
        KVP OS / BUILD 0.1.0
      </span>
      <span className="flex items-center gap-1.5 font-mono text-[7px] tracking-[0.14em] text-dim">
        <Radio size={9} className="text-mint" />
        LOCAL CONTOUR // 127.0.0.1:5173
      </span>
      <span className="flex items-center gap-1.5 font-mono text-[7px] tracking-[0.14em] text-dim">
        <span className={`led ${engineState === 'ACTIVE' ? 'text-mint' : 'text-ice'}`} />
        CORE {engineState} / {latency} MS
      </span>
      <span className="flex items-center gap-1.5 font-mono text-[7px] tracking-[0.14em] text-dim">
        <ShieldCheck size={9} className="text-mint" />
        ETHICAL INTERLOCK ON
      </span>
      <span className="font-mono text-[7px] tracking-[0.14em] text-dim">OPERATOR N. CITY / SESSION 04F2</span>
    </footer>
  )
}
