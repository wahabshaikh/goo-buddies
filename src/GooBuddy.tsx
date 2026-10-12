import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { GooEngine, type EngineOptions } from './core/engine';
import { canvasCssSize, layout } from './core/layout';
import { subscribe } from './core/loop';
import { isGooMaterial, isGooShape, isGooState, type GooBuddyProps } from './types';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);
  return reduced;
}

/**
 * A squishy soft-body goo buddy that shows what an agent is doing.
 *
 * ```tsx
 * <GooBuddy state="thinking" shape="drop" material="jelly" size={160} />
 * ```
 */
export const GooBuddy = forwardRef<HTMLDivElement, GooBuddyProps>(function GooBuddy(
  {
    shape = 'round',
    state = 'idle',
    material = 'jelly',
    size = 128,
    color = '#4fd1a5',
    speed = 1,
    paused = false,
    interactive = true,
    seed,
    level = 0,
    floorShadow = true,
    style,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onPointerLeave,
    ...rest
  },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GooEngine | null>(null);
  const [randomSeed] = useState(() => Math.random() * 1000);
  const [visible, setVisible] = useState(true);
  const [held, setHeld] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const animate = !paused && !reducedMotion;
  const boxRef = useRef<HTMLDivElement | null>(null);

  const options: EngineOptions = {
    shape: isGooShape(shape) ? shape : 'round',
    state: isGooState(state) ? state : 'idle',
    material: isGooMaterial(material) ? material : 'jelly',
    size: Math.max(8, Number.isFinite(size) ? size : 128),
    color,
    speed: Number.isFinite(speed) ? Math.max(0, speed) : 1,
    seed: seed ?? randomSeed,
    level: Number.isFinite(level) ? level : 0,
    floorShadow,
  };

  // Create the engine once, then keep it in sync with props.
  useIsoLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!engineRef.current) engineRef.current = new GooEngine(canvas, options);
    else engineRef.current.setOptions(options);
    if (!animate) engineRef.current.renderStill();
  });

  useEffect(() => () => {
    engineRef.current = null;
  }, []);

  // Pause off-screen buddies.
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '64px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!animate || !visible) return;
    return subscribe((dt) => engineRef.current?.tick(dt));
  }, [animate, visible]);

  // Redraw on device-pixel-ratio changes (zoom, moving between screens).
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    const onChange = () => {
      engineRef.current?.resize();
      if (!animate) engineRef.current?.renderStill();
    };
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [animate]);

  const canPlay = interactive && animate;
  const toUnits = (e: ReactPointerEvent<HTMLDivElement>) =>
    engineRef.current!.toUnits(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());

  const handleDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    onPointerDown?.(e);
    const engine = engineRef.current;
    if (!canPlay || !engine || e.defaultPrevented || e.button > 0) return;
    const [x, y] = toUnits(e);
    if (engine.pointerDown(x, y)) {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setHeld(true);
    }
  };
  const handleMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    onPointerMove?.(e);
    if (!canPlay || !engineRef.current) return;
    const [x, y] = toUnits(e);
    engineRef.current.pointerMove(x, y);
  };
  const release = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    engineRef.current?.pointerUp();
    setHeld(false);
  };
  const handleUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    onPointerUp?.(e);
    release(e);
  };
  const handleCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    onPointerCancel?.(e);
    release(e);
  };
  const handleLeave = (e: ReactPointerEvent<HTMLDivElement>) => {
    onPointerLeave?.(e);
    engineRef.current?.pointerLeave();
  };

  const px = options.size;
  const [cw, ch] = canvasCssSize(px);
  const boxStyle: CSSProperties = {
    position: 'relative',
    display: 'inline-block',
    width: px,
    height: px,
    flexShrink: 0,
    verticalAlign: 'middle',
    cursor: canPlay ? (held ? 'grabbing' : 'grab') : undefined,
    touchAction: canPlay ? 'none' : undefined,
    userSelect: 'none',
    WebkitUserSelect: 'none',
    ...style,
  };
  const canvasStyle: CSSProperties = {
    position: 'absolute',
    left: -layout.padX * px,
    top: -layout.padTop * px,
    width: cw,
    height: ch,
    pointerEvents: 'none',
    display: 'block',
  };

  return (
    <div
      role="img"
      aria-label={`Goo buddy, ${options.state}`}
      {...rest}
      ref={(node) => {
        boxRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      }}
      data-state={options.state}
      data-shape={options.shape}
      data-material={options.material}
      style={boxStyle}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleCancel}
      onPointerLeave={handleLeave}
    >
      <canvas ref={canvasRef} aria-hidden="true" style={canvasStyle} />
    </div>
  );
});
