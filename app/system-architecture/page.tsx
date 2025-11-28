'use client';

import { useState, useRef, useEffect } from 'react';

interface Position {
  x: number;
  y: number;
}

interface Agent {
  id: string;
  name: string;
  type: 'data-source' | 'service' | 'endpoint' | 'ai-agent' | 'output';
  position: Position;
  description: string;
  color: string;
  icon: string;
}

interface Connection {
  from: string;
  to: string;
  label?: string;
  animated?: boolean;
}

export default function SystemArchitecturePage() {
  const [agents, setAgents] = useState<Agent[]>([
    // Data Sources
    { id: 'oura', name: 'Oura Ring', type: 'data-source', position: { x: 50, y: 100 }, description: 'Sleep, HRV, Readiness', color: '#4F46E5', icon: '🌙' },
    { id: 'dexcom', name: 'Dexcom CGM', type: 'data-source', position: { x: 50, y: 200 }, description: 'Glucose Patterns', color: '#4F46E5', icon: '📊' },
    { id: 'vital', name: 'Vital API', type: 'data-source', position: { x: 50, y: 300 }, description: 'Unified Health Data', color: '#4F46E5', icon: '💓' },
    { id: 'gmail', name: 'Gmail', type: 'data-source', position: { x: 50, y: 400 }, description: 'Work Patterns', color: '#4F46E5', icon: '📧' },
    { id: 'slack', name: 'Slack', type: 'data-source', position: { x: 50, y: 500 }, description: 'Stress Indicators', color: '#4F46E5', icon: '💬' },
    { id: 'biomarkers', name: 'Blood Work', type: 'data-source', position: { x: 50, y: 600 }, description: 'Lab Results', color: '#4F46E5', icon: '🩸' },

    // Services Layer
    { id: 'auto-sync', name: 'Auto-Sync Orchestrator', type: 'service', position: { x: 350, y: 150 }, description: 'TTL-based sync coordination', color: '#10B981', icon: '🔄' },
    { id: 'fetcher', name: 'Ecosystem Fetcher', type: 'service', position: { x: 350, y: 300 }, description: 'Parallel data fetching', color: '#10B981', icon: '📥' },
    { id: 'analyzer', name: 'Pattern Analyzer', type: 'service', position: { x: 350, y: 450 }, description: 'Cross-source insights', color: '#10B981', icon: '🔍' },
    { id: 'validator', name: 'Context Validator', type: 'service', position: { x: 350, y: 600 }, description: 'Data quality checks', color: '#10B981', icon: '✅' },

    // Aggregation Endpoint
    { id: 'aggregate', name: 'Context Aggregator', type: 'endpoint', position: { x: 650, y: 350 }, description: 'The Brain - 24h cache', color: '#F59E0B', icon: '🧠' },

    // AI Agents
    { id: 'sage-plan', name: 'Sage Nutrition', type: 'ai-agent', position: { x: 950, y: 150 }, description: 'GPT-5 Nutrition Plan', color: '#EC4899', icon: '🥗' },
    { id: 'forge-plan', name: 'Forge Fitness', type: 'ai-agent', position: { x: 950, y: 250 }, description: 'GPT-5 Fitness Plan', color: '#EC4899', icon: '💪' },
    { id: 'meal-plan', name: 'Meal Planner', type: 'ai-agent', position: { x: 950, y: 350 }, description: 'GPT-5 Detailed Meals', color: '#EC4899', icon: '🍽️' },
    { id: 'micronutrients', name: 'Micronutrients', type: 'ai-agent', position: { x: 950, y: 450 }, description: 'GPT-5 Supplements', color: '#EC4899', icon: '💊' },
    { id: 'lifestyle', name: 'Lifestyle', type: 'ai-agent', position: { x: 950, y: 550 }, description: 'GPT-5 Sleep/Exercise/Stress', color: '#EC4899', icon: '🧘' },

    // Output
    { id: 'output', name: 'Personalized Plan', type: 'output', position: { x: 1250, y: 350 }, description: 'Hyper-personalized with citations', color: '#8B5CF6', icon: '📋' },
  ]);

  const [connections] = useState<Connection[]>([
    // Data sources to Auto-Sync
    { from: 'oura', to: 'auto-sync', label: 'Sync if >24h' },
    { from: 'dexcom', to: 'auto-sync', label: 'Sync if >24h' },
    { from: 'vital', to: 'auto-sync', label: 'Sync if >24h' },
    { from: 'gmail', to: 'auto-sync', label: 'Sync if >24h' },
    { from: 'slack', to: 'auto-sync', label: 'Sync if >24h' },

    // Auto-Sync to Fetcher
    { from: 'auto-sync', to: 'fetcher', label: 'Coordinated fetch', animated: true },

    // All sources to Fetcher
    { from: 'oura', to: 'fetcher', label: 'Sleep/HRV data' },
    { from: 'dexcom', to: 'fetcher', label: 'Glucose data' },
    { from: 'vital', to: 'fetcher', label: 'Unified data' },
    { from: 'gmail', to: 'fetcher', label: 'Work patterns' },
    { from: 'slack', to: 'fetcher', label: 'Stress data' },
    { from: 'biomarkers', to: 'fetcher', label: 'Lab results' },

    // Fetcher to Analyzer
    { from: 'fetcher', to: 'analyzer', label: 'Raw data', animated: true },

    // Analyzer to Validator
    { from: 'analyzer', to: 'validator', label: 'Insights + patterns' },

    // Validator to Aggregator
    { from: 'validator', to: 'aggregate', label: 'Quality report', animated: true },

    // Analyzer to Aggregator
    { from: 'analyzer', to: 'aggregate', label: 'Cross-source insights' },

    // Aggregator to all AI Agents
    { from: 'aggregate', to: 'sage-plan', label: 'Unified context', animated: true },
    { from: 'aggregate', to: 'forge-plan', label: 'Unified context', animated: true },
    { from: 'aggregate', to: 'meal-plan', label: 'Unified context', animated: true },
    { from: 'aggregate', to: 'micronutrients', label: 'Unified context', animated: true },
    { from: 'aggregate', to: 'lifestyle', label: 'Unified context', animated: true },

    // AI Agents to Output
    { from: 'sage-plan', to: 'output', label: 'Nutrition plan' },
    { from: 'forge-plan', to: 'output', label: 'Fitness plan' },
    { from: 'meal-plan', to: 'output', label: 'Meal plan' },
    { from: 'micronutrients', to: 'output', label: 'Supplements' },
    { from: 'lifestyle', to: 'output', label: 'Lifestyle plan' },
  ]);

  const [dragging, setDragging] = useState<string | null>(null);
  const [offset, setOffset] = useState<Position>({ x: 0, y: 0 });
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showFlow, setShowFlow] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent, agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;

    setDragging(agentId);
    setOffset({
      x: e.clientX - agent.position.x,
      y: e.clientY - agent.position.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;

    setAgents(prev =>
      prev.map(agent =>
        agent.id === dragging
          ? {
              ...agent,
              position: {
                x: e.clientX - offset.x,
                y: e.clientY - offset.y,
              },
            }
          : agent
      )
    );
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

  const getAgentPosition = (id: string): Position => {
    const agent = agents.find(a => a.id === id);
    return agent ? { x: agent.position.x + 75, y: agent.position.y + 40 } : { x: 0, y: 0 };
  };

  const simulateFlow = () => {
    setShowFlow(true);
    setTimeout(() => setShowFlow(false), 5000);
  };

  return (
    <div
      className="relative w-full h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 bg-slate-900/80 backdrop-blur-sm border-b border-slate-700 p-6 z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              🧠 Hyper-Personalized AI Orchestration System
            </h1>
            <p className="text-slate-400">
              Interactive multi-agent architecture • Drag nodes to explore • Click for details
            </p>
          </div>
          <button
            onClick={simulateFlow}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg"
          >
            ▶ Simulate Data Flow
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={canvasRef} className="absolute inset-0 pt-32">
        {/* SVG for connections */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 10 3, 0 6" fill="#64748b" />
            </marker>
            <marker
              id="arrowhead-animated"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 10 3, 0 6" fill="#10B981" />
            </marker>
          </defs>

          {connections.map((conn, idx) => {
            const from = getAgentPosition(conn.from);
            const to = getAgentPosition(conn.to);
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;

            return (
              <g key={idx}>
                <path
                  d={`M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`}
                  stroke={conn.animated ? '#10B981' : '#64748b'}
                  strokeWidth="2"
                  fill="none"
                  markerEnd={conn.animated ? 'url(#arrowhead-animated)' : 'url(#arrowhead)'}
                  opacity={showFlow && conn.animated ? 1 : 0.3}
                  className={showFlow && conn.animated ? 'animate-pulse' : ''}
                />
                {conn.label && (
                  <text
                    x={midX}
                    y={midY - 10}
                    fill="#94a3b8"
                    fontSize="11"
                    textAnchor="middle"
                    className="pointer-events-none select-none"
                  >
                    {conn.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Agents */}
        {agents.map(agent => (
          <div
            key={agent.id}
            className={`absolute cursor-move transition-all ${
              dragging === agent.id ? 'scale-110 z-30' : 'z-10'
            } ${selectedAgent?.id === agent.id ? 'ring-4 ring-yellow-400' : ''}`}
            style={{
              left: agent.position.x,
              top: agent.position.y,
              width: '150px',
            }}
            onMouseDown={e => handleMouseDown(e, agent.id)}
            onClick={() => setSelectedAgent(agent)}
          >
            <div
              className="rounded-lg p-4 shadow-2xl backdrop-blur-sm border-2 hover:shadow-xl transition-all"
              style={{
                backgroundColor: `${agent.color}20`,
                borderColor: agent.color,
              }}
            >
              <div className="text-3xl mb-2">{agent.icon}</div>
              <div className="text-white font-semibold text-sm mb-1">{agent.name}</div>
              <div className="text-slate-300 text-xs">{agent.description}</div>
              <div className="mt-2 text-xs font-mono text-slate-400">{agent.type}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="absolute bottom-6 left-6 bg-slate-900/90 backdrop-blur-sm border border-slate-700 rounded-lg p-4 z-20">
        <h3 className="text-white font-semibold mb-3">Legend</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#4F46E5' }}></div>
            <span className="text-slate-300">Data Sources (6)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#10B981' }}></div>
            <span className="text-slate-300">Services Layer (4)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#F59E0B' }}></div>
            <span className="text-slate-300">Context Aggregator (1)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#EC4899' }}></div>
            <span className="text-slate-300">AI Agents (5)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#8B5CF6' }}></div>
            <span className="text-slate-300">Output (1)</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="absolute bottom-6 right-6 bg-slate-900/90 backdrop-blur-sm border border-slate-700 rounded-lg p-4 z-20">
        <h3 className="text-white font-semibold mb-3">System Stats</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Total Agents:</span>
            <span className="text-white font-mono">{agents.length}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Connections:</span>
            <span className="text-white font-mono">{connections.length}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Cache TTL:</span>
            <span className="text-white font-mono">24h</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">AI Models:</span>
            <span className="text-white font-mono">GPT-5</span>
          </div>
        </div>
      </div>

      {/* Selected Agent Detail Panel */}
      {selectedAgent && (
        <div className="absolute top-32 right-6 bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-lg p-6 z-20 w-80 shadow-2xl">
          <div className="flex items-start justify-between mb-4">
            <div className="text-4xl">{selectedAgent.icon}</div>
            <button
              onClick={() => setSelectedAgent(null)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          <h3 className="text-white font-bold text-lg mb-2">{selectedAgent.name}</h3>
          <div className="text-sm mb-4">
            <span
              className="inline-block px-2 py-1 rounded text-white text-xs font-mono"
              style={{ backgroundColor: selectedAgent.color }}
            >
              {selectedAgent.type}
            </span>
          </div>
          <p className="text-slate-300 text-sm mb-4">{selectedAgent.description}</p>

          {/* Type-specific details */}
          {selectedAgent.type === 'data-source' && (
            <div className="bg-slate-800/50 rounded p-3 text-xs space-y-1">
              <div className="text-slate-400">Sync Frequency: Every 24h</div>
              <div className="text-slate-400">Data Format: JSONB</div>
              <div className="text-slate-400">Storage: PostgreSQL</div>
            </div>
          )}
          {selectedAgent.type === 'service' && (
            <div className="bg-slate-800/50 rounded p-3 text-xs space-y-1">
              <div className="text-slate-400">Language: TypeScript</div>
              <div className="text-slate-400">Execution: Parallel</div>
              <div className="text-slate-400">Error Handling: Graceful fallback</div>
            </div>
          )}
          {selectedAgent.type === 'endpoint' && (
            <div className="bg-slate-800/50 rounded p-3 text-xs space-y-1">
              <div className="text-slate-400">Route: /api/aggregate-context</div>
              <div className="text-slate-400">Method: POST</div>
              <div className="text-slate-400">Cache: 24h in PostgreSQL</div>
            </div>
          )}
          {selectedAgent.type === 'ai-agent' && (
            <div className="bg-slate-800/50 rounded p-3 text-xs space-y-1">
              <div className="text-slate-400">
                Model: GPT-5
              </div>
              <div className="text-slate-400">Mode: Ecosystem-enriched</div>
              <div className="text-slate-400">Citations: 2-3 per recommendation</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
