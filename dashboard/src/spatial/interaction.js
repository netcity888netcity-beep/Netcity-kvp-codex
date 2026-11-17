/**
 * NetCity Spatial Engine — input state machine.
 * Handles pointer/gaze focus and drag intent without DOM or renderer coupling.
 */
export function createSpatialInteractionState() {
  return { focusedId: null, hoveredId: null, activePointerId: null, drag: null, sequence: 0 };
}
function finitePoint(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new TypeError('pointer coordinates must be finite numbers');
  return { x, y };
}
export function reduceSpatialInteraction(state, event) {
  switch (event?.type) {
    case 'focus':
      return { ...state, focusedId: event.nodeId ?? null, sequence: state.sequence + 1 };
    case 'gaze':
      return { ...state, hoveredId: event.nodeId ?? null, sequence: state.sequence + 1 };
    case 'pointer-down': {
      const point = finitePoint(event.x, event.y);
      if (state.activePointerId != null) return state;
      return {
        ...state,
        focusedId: event.nodeId ?? state.focusedId,
        activePointerId: event.pointerId,
        drag: { nodeId: event.nodeId ?? null, origin: point, current: point, delta: { x: 0, y: 0 } },
        sequence: state.sequence + 1,
      };
    }
    case 'pointer-move': {
      if (state.activePointerId !== event.pointerId || !state.drag) return state;
      const point = finitePoint(event.x, event.y);
      return {
        ...state,
        drag: {
          ...state.drag,
          current: point,
          delta: { x: point.x - state.drag.origin.x, y: point.y - state.drag.origin.y },
        },
        sequence: state.sequence + 1,
      };
    }
    case 'pointer-up':
    case 'pointer-cancel':
      if (state.activePointerId !== event.pointerId) return state;
      return { ...state, activePointerId: null, drag: null, sequence: state.sequence + 1 };
    case 'reset':
      return createSpatialInteractionState();
    default:
      return state;
  }
}
