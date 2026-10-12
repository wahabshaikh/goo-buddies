import type { GooShape, GooState } from 'goo-buddies';

export const stateNotes: Record<GooState, string> = {
  idle: 'Gentle wobble, blinks and glances',
  thinking: 'Stretches up, bubbles rise inside',
  searching: 'Oozes side to side, darting eyes',
  listening: 'Ripples driven by the level prop',
  speaking: 'Mouth and body pulse with speech',
  working: 'Churns and flings droplets',
  happy: 'Bouncy squash and stretch',
  error: 'Shivers, murky colour, X eyes',
  sleeping: 'Melts into a puddle, z bubbles',
};

export const swatches = ['#4fd1a5', '#8b9cff', '#f5a3c7', '#ffc56b', '#7cc7ff', '#b98cff', '#ff8a7a', '#a3d977'];

export interface Agent {
  name: string;
  role: string;
  shape: GooShape;
  color: string;
  script: readonly { state: GooState; text: string }[];
}

export const agents: Agent[] = [
  {
    name: 'Planner',
    role: 'orchestrator',
    shape: 'drop',
    color: '#8b9cff',
    script: [
      { state: 'thinking', text: 'Breaking the task into steps…' },
      { state: 'thinking', text: 'Weighing two approaches…' },
      { state: 'working', text: 'Assigning 4 subtasks' },
      { state: 'idle', text: 'Waiting on the coder' },
      { state: 'happy', text: 'Plan approved' },
    ],
  },
  {
    name: 'Scout',
    role: 'research',
    shape: 'puffball',
    color: '#f5a3c7',
    script: [
      { state: 'searching', text: 'Searching docs for "verlet"' },
      { state: 'searching', text: 'Reading 12 results' },
      { state: 'thinking', text: 'Summarising findings' },
      { state: 'happy', text: 'Found 3 good sources' },
      { state: 'idle', text: 'Ready' },
    ],
  },
  {
    name: 'Builder',
    role: 'code',
    shape: 'cube',
    color: '#4fd1a5',
    script: [
      { state: 'working', text: 'Editing src/engine.ts' },
      { state: 'working', text: 'Running bun test' },
      { state: 'error', text: '2 tests failed' },
      { state: 'thinking', text: 'Reading the stack trace' },
      { state: 'working', text: 'Patching the floor constraint' },
      { state: 'happy', text: 'All 33 tests pass' },
    ],
  },
  {
    name: 'Echo',
    role: 'voice',
    shape: 'round',
    color: '#ffc56b',
    script: [
      { state: 'listening', text: 'Listening…' },
      { state: 'listening', text: 'Listening…' },
      { state: 'thinking', text: 'Transcribing' },
      { state: 'speaking', text: '"Here is what I found…"' },
      { state: 'speaking', text: '"…and the build is green."' },
    ],
  },
  {
    name: 'Night owl',
    role: 'monitor',
    shape: 'round',
    color: '#7cc7ff',
    script: [
      { state: 'sleeping', text: 'No alerts in 6h' },
      { state: 'sleeping', text: 'No alerts in 6h' },
      { state: 'sleeping', text: 'No alerts in 6h' },
      { state: 'idle', text: 'Woke up: new deploy' },
      { state: 'searching', text: 'Checking error rates' },
      { state: 'happy', text: 'All clear' },
    ],
  },
];
