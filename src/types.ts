import type { HTMLAttributes } from 'react';

/** Every state a buddy can be in, in the order the playground shows them. */
export const gooStates = [
  'idle',
  'thinking',
  'searching',
  'listening',
  'speaking',
  'working',
  'happy',
  'error',
  'sleeping',
] as const;

/** Every body outline a buddy can have. */
export const gooShapes = ['drop', 'round', 'cube', 'puffball'] as const;

/** Every surface a buddy can be made of. */
export const gooMaterials = ['jelly', 'slime', 'gummy'] as const;

export type GooState = (typeof gooStates)[number];
export type GooShape = (typeof gooShapes)[number];
export type GooMaterial = (typeof gooMaterials)[number];

export interface GooBuddyProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'color' | 'children'> {
  /** Body outline. Default `"round"`. */
  shape?: GooShape;
  /** What the agent is doing. Default `"idle"`. */
  state?: GooState;
  /** Surface finish. Default `"jelly"`. */
  material?: GooMaterial;
  /** Width and height of the layout box, in CSS pixels. Default `128`. */
  size?: number;
  /** Body colour: any CSS colour. Default `"#4fd1a5"`. */
  color?: string;
  /** Multiplier on every animation (not on the physics). Default `1`. */
  speed?: number;
  /** Hold the state's still pose instead of animating. Default `false`. */
  paused?: boolean;
  /** Poke to dent and jiggle, drag to stretch; eyes follow the pointer. Default `true`. */
  interactive?: boolean;
  /** Any number; desyncs blinks, glances and particles across a row of buddies. Random by default. */
  seed?: number;
  /** 0–1 input level that drives the ripples while `listening`. Default `0`. */
  level?: number;
  /** Soft contact shadow under the body. Default `true`. */
  floorShadow?: boolean;
}

const stateSet = new Set<string>(gooStates);
const shapeSet = new Set<string>(gooShapes);
const materialSet = new Set<string>(gooMaterials);

export const isGooState = (value: unknown): value is GooState =>
  typeof value === 'string' && stateSet.has(value);
export const isGooShape = (value: unknown): value is GooShape =>
  typeof value === 'string' && shapeSet.has(value);
export const isGooMaterial = (value: unknown): value is GooMaterial =>
  typeof value === 'string' && materialSet.has(value);
