import React from 'react';
import { KvpHud } from './components/KvpHud';

export default function App() {
  return (
    <div className="relative w-screen h-screen bg-[#060a0f] overflow-hidden">
      {/* Тонкая пространственная сетка реальности */}
      <div
        className="pointer-events-none fixed inset-0 opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(circle at center, rgba(125,246,209,0.18) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        }}
      />
      <KvpHud />
    </div>
  );
}
