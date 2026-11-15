export default function SpatialFrame() {
  const ticks = [3, 2, 1, 3, 1, 2, 3, 1, 2]

  return (
    <div className="pointer-events-none fixed inset-0 z-20" aria-hidden="true">
      <span className="absolute left-2 top-2 h-5 w-5 border-l border-t border-mint/20 sm:h-6 sm:w-6" />
      <span className="absolute right-2 top-2 h-5 w-5 border-r border-t border-mint/20 sm:h-6 sm:w-6" />
      <span className="absolute bottom-2 left-2 h-5 w-5 border-b border-l border-mint/20 sm:h-6 sm:w-6" />
      <span className="absolute bottom-2 right-2 h-5 w-5 border-b border-r border-mint/20 sm:h-6 sm:w-6" />

      <div className="absolute left-2 top-1/2 hidden -translate-y-1/2 flex-col items-start gap-1.5 xl:flex">
        {ticks.map((width, index) => (
          <span
            key={index}
            className={`block h-px bg-mint/25 ${width === 3 ? 'w-3' : width === 2 ? 'w-2' : 'w-1.5'}`}
          />
        ))}
      </div>

      <div className="absolute right-2 top-1/2 hidden -translate-y-1/2 flex-col items-end gap-1.5 xl:flex">
        {ticks.map((width, index) => (
          <span
            key={index}
            className={`block h-px bg-ice/20 ${width === 3 ? 'w-3' : width === 2 ? 'w-2' : 'w-1.5'}`}
          />
        ))}
      </div>

      <div className="absolute left-1/2 top-3 hidden -translate-x-1/2 items-center gap-2 font-mono text-[7px] tracking-[0.2em] text-dim lg:flex">
        <span className="h-px w-7 bg-gradient-to-r from-transparent to-mint/25" />
        HDG 000 / LOCAL
        <span className="h-px w-7 bg-gradient-to-l from-transparent to-mint/25" />
      </div>

      <div className="absolute bottom-2 left-1/2 hidden -translate-x-1/2 items-center gap-2 font-mono text-[7px] tracking-[0.2em] text-dim sm:flex">
        <span className="h-px w-8 bg-gradient-to-r from-transparent to-mint/25" />
        <span className="h-1 w-1 rounded-full bg-mint/60 shadow-[0_0_8px_rgba(125,246,209,0.7)]" />
        SPATIAL LOCK
        <span className="h-1 w-1 rounded-full bg-ice/50" />
        <span className="h-px w-8 bg-gradient-to-l from-transparent to-mint/25" />
      </div>
    </div>
  )
}
