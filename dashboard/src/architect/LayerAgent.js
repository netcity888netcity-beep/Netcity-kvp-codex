/**
 * NetCity Architect Runtime — Layer Agents (Direction 03).
 *
 * Each layer of the AR stack gets a specialized agent answering status
 * queries with layer-specific mock telemetry. Pure module: no React,
 * no Three.js — HUD renders, router routes, agent reports.
 */

const AGENT_STATUS = Object.freeze({
  core: 'Status: Nominal, Quorum: 7/7',
  tech: 'Fleet: 8 nodes online',
  civic: 'Status: 128 sessions, Civic load 42%',
  energy: 'Status: Stable, Output: 1.2 GW',
  bio: 'Vitals: Optimal',
  info: 'Index: 14.2M artifacts, Freshness: 3m',
  ident: 'PKI intact, Certs: 512 valid',
});

export const AGENT_LAYER_IDS = Object.freeze(Object.keys(AGENT_STATUS));

export class LayerAgent {
  constructor(layerId) {
    if (typeof layerId !== 'string' || layerId.trim() === '') {
      throw new TypeError('LayerAgent requires a non-empty layerId');
    }
    this.layerId = layerId.trim();
  }

  getStatus() {
    const status = AGENT_STATUS[this.layerId];
    if (!status) {
      return { layerId: this.layerId, status: 'Status: Unknown layer', known: false };
    }
    return { layerId: this.layerId, status, known: true };
  }
}

export function agentStatusLine(layerId) {
  const agent = new LayerAgent(layerId).getStatus();
  return '[' + layerId.toUpperCase() + '] ' + agent.status;
}
