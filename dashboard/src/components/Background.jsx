const DUST = [
  { left: '9%', top: '24%', delay: '0s', duration: '13s' },
  { left: '17%', top: '68%', delay: '1.4s', duration: '16s' },
  { left: '28%', top: '14%', delay: '2.8s', duration: '12s' },
  { left: '38%', top: '82%', delay: '0.8s', duration: '17s' },
  { left: '46%', top: '34%', delay: '3.4s', duration: '14s' },
  { left: '57%', top: '12%', delay: '1.9s', duration: '15s' },
  { left: '64%', top: '74%', delay: '0.4s', duration: '13s' },
  { left: '73%', top: '28%', delay: '2.2s', duration: '18s' },
  { left: '81%', top: '58%', delay: '3.8s', duration: '12s' },
  { left: '89%', top: '18%', delay: '1.1s', duration: '16s' },
  { left: '94%', top: '84%', delay: '2.6s', duration: '14s' },
  { left: '52%', top: '92%', delay: '0.2s', duration: '19s' },
]

export default function Background() {
  return (
    <div className="ar-bg" aria-hidden="true">
      <div className="grid-plane" />
      <div className="grid-plane grid-plane--far" />
      <div className="scan-beam" />

      {DUST.map((particle, index) => (
        <span
          key={index}
          className="dust"
          style={{
            left: particle.left,
            top: particle.top,
            animationDelay: particle.delay,
            animationDuration: particle.duration,
          }}
        />
      ))}

      <div className="absolute left-1/2 top-1/2 h-[76vmin] w-[76vmin] -translate-x-1/2 -translate-y-1/2 rounded-full border border-mint/[0.035]" />
      <div className="absolute left-1/2 top-1/2 h-[54vmin] w-[54vmin] -translate-x-1/2 -translate-y-1/2 rounded-full border border-mint/[0.045]" />
      <div className="absolute left-1/2 top-1/2 h-[34vmin] w-[34vmin] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-ice/[0.04]" />

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_32%,rgba(3,6,8,0.68)_100%)]" />
    </div>
  )
}
