# goo-buddies

Squishy soft-body slime buddies for React that show what your AI agent is doing. Each buddy is a blob of goo with a face. It thinks, searches, listens, speaks, works, celebrates, errors and sleeps, and it dents when you poke it and stretches when you drag it.

The buddies are drawn on a 2D canvas and moved by spring-mass (verlet) physics. There's no WebGL and no runtime dependencies.

## Install

```bash
npm install goo-buddies
# or
bun add goo-buddies
```

React 18 or newer is a peer dependency.

## Quick start

```tsx
import { GooBuddy } from 'goo-buddies';

function Agent({ status }: { status: 'idle' | 'thinking' | 'speaking' }) {
  return <GooBuddy state={status} size={128} />;
}
```

A voice agent can feed its microphone level into `listening`:

```tsx
<GooBuddy state="listening" level={micLevel /* 0–1 */} shape="drop" />
```

## States

Each state has its own motion, face and particles. When the state changes, the body eases from one pose into the next, and the eyes blink through the switch.

| State | Body | Face | Extras |
|---|---|---|---|
| `idle` | gentle breathing wobble | blinks, glances around | |
| `thinking` | stretches up, leans | looks up and aside | bubbles rise inside the goo |
| `searching` | oozes side to side, the top lagging behind | eyes dart about | |
| `listening` | ripples run round the surface, stronger with `level` | wide, attentive eyes | |
| `speaking` | pulses with each syllable | mouth moves with the words | |
| `working` | churns | focused eyes, looking down | droplets fly off and splat on the floor |
| `happy` | bouncy hops, squashing on every landing | `^ ^` eyes, open smile, blush | sparkles |
| `error` | shivers, turns a murky version of its colour | `X X` eyes, frown | |
| `sleeping` | melts into a puddle, slow breathing | closed eyes | z bubbles drift up |

The list is exported as `gooStates`.

## Shapes and materials

```tsx
<GooBuddy shape="round" />     {/* a classic blob (default) */}
<GooBuddy shape="drop" />      {/* a teardrop, point up */}
<GooBuddy shape="cube" />      {/* a soft cube of jelly */}
<GooBuddy shape="puffball" />  {/* a pom-pom of nine bumps */}

<GooBuddy material="jelly" />  {/* translucent, light shows through (default) */}
<GooBuddy material="slime" />  {/* opaque and glossy */}
<GooBuddy material="gummy" />  {/* candy-like, soft sheen, sugar-dusted */}
```

All shapes share the same ring of mass points, so changing `shape` makes one shape melt into the other. The lists are exported as `gooShapes` and `gooMaterials`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `state` | `GooState` | `"idle"` | What the agent is doing (see [States](#states)). |
| `shape` | `GooShape` | `"round"` | `drop`, `round`, `cube` or `puffball`. |
| `material` | `GooMaterial` | `"jelly"` | `jelly`, `slime` or `gummy`. |
| `size` | `number` | `128` | Width and height of the layout box, in px. |
| `color` | `string` | `"#4fd1a5"` | Body colour. Accepts any CSS colour. |
| `speed` | `number` | `1` | Multiplier on every animation. The physics always runs in real time. |
| `paused` | `boolean` | `false` | Draw the state's still pose instead of animating. |
| `interactive` | `boolean` | `true` | Poke to dent and jiggle, drag to stretch. The eyes follow a nearby pointer. |
| `seed` | `number` | random | Desyncs blinks, glances and particles across a row of buddies. Set it for deterministic output. |
| `level` | `number` | `0` | 0–1 input level. It drives the ripples while `listening`. |
| `floorShadow` | `boolean` | `true` | Soft contact shadow under the body. |

Any other attribute (`className`, `style`, `onClick`, `aria-label`, `data-*` and so on) goes on the root `<div>`, and a `ref` reaches that `<div>`. The root also carries `data-state`, `data-shape` and `data-material`, which you can use for styling.

TypeScript types are included: `GooBuddyProps`, `GooState`, `GooShape`, `GooMaterial`, plus the guards `isGooState`, `isGooShape` and `isGooMaterial`.

## Sizing and layout

`size` sets the box: the element is a `size` × `size` box, and the resting buddy sits on a floor near its bottom edge. You can use it like an icon or an avatar in a flex row, a grid or next to text.

The motion is drawn on a larger canvas that overflows the box without taking up any layout space, the way a CSS `box-shadow` does. That covers hops, stretches, flying droplets, z bubbles and the floor shadow. Only the box takes clicks. If the box's parent has `overflow: hidden`, those effects will be clipped.

## Behaviour

- **Poke and drag.** With `interactive` on, a click dents the goo where you hit it. The rest of the body bulges to keep its volume, and the whole thing jiggles back. Dragging stretches the goo towards the pointer, up to a limit, and letting go snaps it back. Touch works too: the box sets `touch-action: none` while interactive.
- **Reduced motion.** With `prefers-reduced-motion: reduce`, or with `paused`, the still pose of the state is drawn instead of the animation. The still poses stay legible: a thinking buddy has bubbles, a sleeping one a puddle and z's, a working one droplets in mid-air.
- **Accessible by default.** The root has `role="img"` and an `aria-label` that names the state (for example "Goo buddy, thinking"). Pass your own `aria-label` to override it.
- **Cheap to run many.** Every buddy on the page shares one `requestAnimationFrame` loop. The loop stops when no buddy needs it, browsers pause it in hidden tabs, and buddies scrolled off-screen stop simulating.

## How it works

The body is a ring of 72 verlet mass points. Every frame, the current state's pose (stretch, sway, hop, ripple, churn, melt and so on) produces a target outline. Each point is pulled towards its target by a spring. Three more rules shape the result:

- Neighbouring points share their displacement from the target, so a dent spreads smoothly while the shape's own features (the drop's tip, the puffball's bumps) survive.
- An area constraint keeps the goo incompressible.
- A floor with friction keeps the body grounded.

The springs lag behind fast-moving targets, and that lag is where the squash, wobble and overshoot come from. Switching states eases one pose into the next.

The outline is drawn as a closed Catmull–Rom spline. The material comes from a few layers: a radial body gradient, bottom shading, an inner core and rim light for jelly, sugar specks for gummy, and a gloss streak that follows the upper-left rim, so it holds up through any squish.

## Development

The repo is a Bun workspace. The library lives at the root and the playground in `site/`, a Vite + React app with a few shadcn/ui-style components. The playground imports the library's source directly, so edits hot-reload.

```bash
bun install
bun run dev        # the playground
bun run build      # the library, to dist/ (ESM, CJS, bundled .d.ts)
bun test           # physics, motion, shape and util tests
bun run typecheck
bun run build:site # the playground, to site/dist/
```

The playground reads `?state=`, `?shape=`, `?material=` and `?color=` (hex without `#`) from the URL.

```
src/
  GooBuddy.tsx    the React component
  types.ts        props, the state/shape/material lists and guards
  core/
    softbody.ts   verlet ring, springs, area constraint, poke and drag
    shapes.ts     the four outlines, resampled evenly by arc length
    poses.ts      one numeric pose per state, blending
    motion.ts     pose + time → target outline (hop, sway, ripple, churn, melt…)
    engine.ts     simulation loop, face, particles and canvas drawing
    loop.ts       the shared animation loop
test/             bun tests
site/             the playground
```

## License

[MIT](LICENSE) © Wahab Shaikh
