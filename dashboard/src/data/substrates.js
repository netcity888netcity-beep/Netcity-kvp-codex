import { Boxes, Cpu, Dna, Zap } from 'lucide-react'

export const SUBSTRATES = [
  {
    id: 'digital',
    code: 'KV·1',
    short: 'DIG',
    label: 'DIGITAL',
    ru: 'Цифровая среда',
    hex: '#7df6d1',
    icon: Cpu,
    angle: -90,
    band: 'PACKET / LOGIC',
    phase: 12,
    coherence: 96,
    role: 'KVP control plane, model fleets and the evidence fabric.',
    trace: 'workspace.scan -> local bus -> evidence seal',
  },
  {
    id: 'bio',
    code: 'KV·2',
    short: 'BIO',
    label: 'BIOLOGICAL',
    ru: 'Биологическая среда',
    hex: '#8fe3b0',
    icon: Dna,
    angle: 0,
    band: 'RHYTHM / INTENT',
    phase: 41,
    coherence: 88,
    role: 'Operator intent, consent scope and live cognitive rhythm.',
    trace: 'intent.capture -> consent gate -> operator owned',
  },
  {
    id: 'energy',
    code: 'KV·3',
    short: 'NRG',
    label: 'ENERGY',
    ru: 'Энергетическая среда',
    hex: '#ffb86b',
    icon: Zap,
    angle: 90,
    band: 'POWER / FLUX',
    phase: 67,
    coherence: 81,
    role: 'Throughput budget, thermal envelope and execution flux.',
    trace: 'power.envelope -> flux limiter -> safe hold',
  },
  {
    id: 'material',
    code: 'KV·4',
    short: 'MAT',
    label: 'MATERIAL',
    ru: 'Материальная среда',
    hex: '#b9a3ff',
    icon: Boxes,
    angle: 180,
    band: 'BODY / DEVICE',
    phase: 29,
    coherence: 93,
    role: 'Devices, nodes and the physical contour under the operator.',
    trace: 'node.attach -> key issue -> physical anchor',
  },
]

export const ORDER = SUBSTRATES.map((substrate) => substrate.id)

export const SUBSTRATE_BY_ID = Object.fromEntries(
  SUBSTRATES.map((substrate) => [substrate.id, substrate]),
)

export const COUPLING = {
  digital: { digital: 1, bio: 0.74, energy: 0.61, material: 0.88 },
  bio: { digital: 0.74, bio: 1, energy: 0.69, material: 0.52 },
  energy: { digital: 0.61, bio: 0.69, energy: 1, material: 0.81 },
  material: { digital: 0.88, bio: 0.52, energy: 0.81, material: 1 },
}

export function couplingAverage(id) {
  const row = COUPLING[id]
  const values = ORDER.filter((key) => key !== id).map((key) => row[key])
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function linkQuality(telemetry) {
  if (!telemetry) return 1
  const latencyPenalty = Math.min(1, telemetry.latency / 40)
  const loadPenalty = (telemetry.cpu + telemetry.memory) / 200
  return Math.max(0.3, 1 - latencyPenalty * 0.35 - loadPenalty * 0.35)
}
