/**
 * Layout of a buddy inside its `size` × `size` box, as fractions of `size`.
 * The canvas is larger than the box so hops, droplets and z's can overflow it
 * without taking up layout space.
 */
export const layout = {
  /** One body unit (the rest half-width of the body). */
  unit: 0.36,
  /** Where the floor is, measured down from the top of the box. */
  floor: 0.93,
  padX: 0.45,
  padTop: 0.65,
  padBottom: 0.2,
} as const;

export const canvasCssSize = (size: number): [width: number, height: number] => [
  size * (1 + 2 * layout.padX),
  size * (1 + layout.padTop + layout.padBottom),
];
