import { useState } from 'react';
import { Check, Copy, Mic, Shuffle } from 'lucide-react';
import {
  GooBuddy,
  gooMaterials,
  gooShapes,
  gooStates,
  isGooMaterial,
  isGooShape,
  isGooState,
  type GooMaterial,
  type GooShape,
  type GooState,
} from 'goo-buddies';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup } from '@/components/ui/toggle-group';
import { agents, stateNotes, swatches, type Agent } from './content';
import { useFakeLevel, useScript } from './hooks';

interface Settings {
  state: GooState;
  shape: GooShape;
  material: GooMaterial;
  color: string;
  size: number;
  speed: number;
  seed: number;
  level: number;
  autoLevel: boolean;
  paused: boolean;
  interactive: boolean;
  floorShadow: boolean;
}

const initial: Settings = {
  state: 'idle',
  shape: 'round',
  material: 'jelly',
  color: '#4fd1a5',
  size: 200,
  speed: 1,
  seed: 0.42,
  level: 0.5,
  autoLevel: true,
  paused: false,
  interactive: true,
  floorShadow: true,
};

/** Read initial settings from the URL, e.g. `?state=thinking&shape=drop&material=slime`. */
function fromUrl(): Settings {
  if (typeof location === 'undefined') return initial;
  const q = new URLSearchParams(location.search);
  const next = { ...initial };
  const state = q.get('state');
  const shape = q.get('shape');
  const material = q.get('material');
  const color = q.get('color');
  if (isGooState(state)) next.state = state;
  if (isGooShape(shape)) next.shape = shape;
  if (isGooMaterial(material)) next.material = material;
  if (color && /^[0-9a-f]{6}$/i.test(color)) next.color = `#${color}`;
  return next;
}

export function App() {
  const [s, setS] = useState<Settings>(fromUrl);
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setS((prev) => ({ ...prev, [key]: value }));
  const fakeLevel = useFakeLevel(s.autoLevel && s.state === 'listening');
  const level = s.autoLevel ? fakeLevel : s.level;

  return (
    <div className="mx-auto max-w-6xl px-5 pb-24">
      <Header />

      <section aria-labelledby="playground" className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <h2 id="playground" className="sr-only">
          Playground
        </h2>
        <Card className="overflow-hidden py-0">
          <div className="relative flex min-h-[420px] flex-1 items-end justify-center bg-[radial-gradient(ellipse_at_50%_100%,var(--muted),transparent_70%)] pb-16 pt-28">
            <GooBuddy
              state={s.state}
              shape={s.shape}
              material={s.material}
              color={s.color}
              size={s.size}
              speed={s.speed}
              seed={s.seed}
              level={level}
              paused={s.paused}
              interactive={s.interactive}
              floorShadow={s.floorShadow}
            />
            <p className="absolute top-4 left-5 text-sm text-muted-foreground">
              {s.interactive ? 'Poke it. Drag it.' : 'Interaction is off.'}
            </p>
            <Badge className="absolute top-4 right-5 bg-card">{s.state}</Badge>
          </div>
          <CodeLine settings={s} />
        </Card>

        <Controls s={s} set={set} level={level} />
      </section>

      <Section title="States" description="Nine states, each with its own motion, face and particles. Switching eases one pose into the next.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {gooStates.map((state, i) => (
            <button
              key={state}
              type="button"
              onClick={() => set('state', state)}
              className="group flex flex-col items-center gap-3 rounded-xl border bg-card px-4 pt-10 pb-4 text-left shadow-sm transition-colors hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none aria-pressed:border-ring"
              aria-pressed={s.state === state}
            >
              <GooBuddy
                state={state}
                shape={s.shape}
                material={s.material}
                color={s.color}
                size={96}
                seed={i * 7.3}
                level={state === 'listening' ? fakeLevelFor(i) : 0}
                interactive={false}
                aria-hidden
                role="presentation"
              />
              <div className="w-full text-center">
                <div className="font-mono text-sm font-medium">{state}</div>
                <div className="text-xs text-muted-foreground">{stateNotes[state]}</div>
              </div>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Shapes × materials" description="Four outlines, three surfaces. All shapes share the same rim of mass points, so changing shape morphs too.">
        <Card className="py-4">
          <CardContent className="overflow-x-auto px-4">
            <table className="w-full border-separate border-spacing-y-1">
              <thead>
                <tr>
                  <th className="w-24" />
                  {gooShapes.map((shape) => (
                    <th key={shape} scope="col" className="pb-2 font-mono text-sm font-medium">
                      {shape}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gooMaterials.map((material, r) => (
                  <tr key={material}>
                    <th scope="row" className="pr-2 text-left font-mono text-sm font-medium">
                      {material}
                    </th>
                    {gooShapes.map((shape, c) => (
                      <td key={shape} className="pt-8 pb-2 text-center">
                        <GooBuddy
                          shape={shape}
                          material={material}
                          color={swatches[(r * 4 + c) % swatches.length]}
                          size={88}
                          seed={r * 4 + c}
                          aria-label={`${material} ${shape}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </Section>

      <Section title="Agent status board" description="A mock multi-agent run. Each buddy follows its agent's status.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {agents.map((agent, i) => (
            <AgentCard key={agent.name} agent={agent} index={i} material={s.material} />
          ))}
        </div>
      </Section>

      <Footer />
    </div>
  );
}

const fakeLevelFor = (i: number) => 0.35 + 0.1 * (i % 3);

function Header() {
  const [copied, setCopied] = useState(false);
  const cmd = 'npm install goo-buddies';
  return (
    <header className="flex flex-col gap-6 py-12 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-end gap-4">
        <GooBuddy state="happy" shape="drop" size={64} seed={3} aria-label="goo-buddies logo" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">goo-buddies</h1>
          <p className="mt-1 max-w-md text-muted-foreground">
            Squishy soft-body slime buddies for React that show what your AI agent is doing.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <code className="rounded-md border bg-card px-3 py-2 font-mono text-sm">{cmd}</code>
        <Button
          variant="outline"
          size="icon"
          aria-label={copied ? 'Copied' : 'Copy install command'}
          onClick={() => {
            void navigator.clipboard?.writeText(cmd);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
    </header>
  );
}

function Controls({
  s,
  set,
  level,
}: {
  s: Settings;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  level: number;
}) {
  return (
    <Card className="gap-5">
      <CardHeader>
        <CardTitle>Controls</CardTitle>
        <CardDescription>Every prop, live.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <Field label="state">
          <div role="radiogroup" aria-label="state" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
            {gooStates.map((state) => (
              <button
                key={state}
                type="button"
                role="radio"
                aria-checked={s.state === state}
                onClick={() => set('state', state)}
                className={
                  'rounded-md px-2 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ' +
                  (s.state === state ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')
                }
              >
                {state}
              </button>
            ))}
          </div>
        </Field>
        <Field label="shape">
          <ToggleGroup label="shape" value={s.shape} options={gooShapes} onValueChange={(v) => set('shape', v)} />
        </Field>
        <Field label="material">
          <ToggleGroup label="material" value={s.material} options={gooMaterials} onValueChange={(v) => set('material', v)} />
        </Field>
        <Field label="color">
          <div className="flex flex-wrap items-center gap-1.5">
            {swatches.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                aria-pressed={s.color === c}
                onClick={() => set('color', c)}
                className="size-6 rounded-full border-2 border-card shadow-[0_0_0_1px_var(--border)] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:shadow-[0_0_0_2px_var(--primary)]"
                style={{ background: c }}
              />
            ))}
            <input
              type="color"
              aria-label="Custom color"
              value={s.color}
              onChange={(e) => set('color', e.target.value)}
              className="size-6 cursor-pointer rounded-full border-0 bg-transparent p-0"
            />
          </div>
        </Field>
        <RangeField label="size" value={s.size} min={32} max={280} step={4} format={(v) => `${v}px`} onChange={(v) => set('size', v)} />
        <RangeField label="speed" value={s.speed} min={0} max={3} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={(v) => set('speed', v)} />
        <div className="flex items-end gap-2">
          <RangeField
            className="flex-1"
            label="seed"
            value={s.seed}
            min={0}
            max={1}
            step={0.01}
            format={(v) => v.toFixed(2)}
            onChange={(v) => set('seed', v)}
          />
          <Button variant="outline" size="icon" aria-label="Random seed" onClick={() => set('seed', Math.round(Math.random() * 100) / 100)}>
            <Shuffle />
          </Button>
        </div>
        <div className="flex items-end gap-2">
          <RangeField
            className="flex-1"
            label="level"
            value={level}
            min={0}
            max={1}
            step={0.01}
            format={(v) => v.toFixed(2)}
            disabled={s.autoLevel}
            onChange={(v) => set('level', v)}
          />
          <Button
            variant={s.autoLevel ? 'default' : 'outline'}
            size="icon"
            aria-pressed={s.autoLevel}
            aria-label="Simulate a microphone"
            title="Simulate a microphone (while listening)"
            onClick={() => set('autoLevel', !s.autoLevel)}
          >
            <Mic />
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-3 border-t pt-4">
          <SwitchField label="paused" checked={s.paused} onChange={(v) => set('paused', v)} />
          <SwitchField label="interactive" checked={s.interactive} onChange={(v) => set('interactive', v)} />
          <SwitchField label="floorShadow" checked={s.floorShadow} onChange={(v) => set('floorShadow', v)} />
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
  disabled,
  className,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  const id = `range-${label}`;
  return (
    <div className={'flex flex-col gap-1.5 ' + (className ?? '')}>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="font-mono text-xs text-muted-foreground">
          {label}
        </label>
        <span className="font-mono text-xs tabular-nums">{format(value)}</span>
      </div>
      <Slider id={id} value={value} min={min} max={max} step={step} disabled={disabled} onValueChange={onChange} />
    </div>
  );
}

function SwitchField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = `switch-${label}`;
  return (
    <div className="flex items-center justify-between">
      <Label htmlFor={id} className="font-mono text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function CodeLine({ settings: s }: { settings: Settings }) {
  const props: string[] = [];
  if (s.shape !== 'round') props.push(`shape="${s.shape}"`);
  props.push(`state="${s.state}"`);
  if (s.material !== 'jelly') props.push(`material="${s.material}"`);
  if (s.color !== '#4fd1a5') props.push(`color="${s.color}"`);
  props.push(`size={${s.size}}`);
  if (s.speed !== 1) props.push(`speed={${s.speed}}`);
  if (s.state === 'listening') props.push('level={micLevel}');
  if (s.paused) props.push('paused');
  if (!s.interactive) props.push('interactive={false}');
  if (!s.floorShadow) props.push('floorShadow={false}');
  return (
    <pre className="overflow-x-auto border-t bg-muted/50 px-5 py-3 font-mono text-xs">
      <code>{`<GooBuddy ${props.join(' ')} />`}</code>
    </pre>
  );
}

function AgentCard({ agent, index, material }: { agent: Agent; index: number; material: GooMaterial }) {
  const step = useScript(agent.script, 2600 + index * 170, index);
  const level = useFakeLevel(step.state === 'listening');
  return (
    <Card className="items-center gap-3 px-4 pt-10 pb-4 text-center">
      <GooBuddy
        state={step.state}
        shape={agent.shape}
        color={agent.color}
        material={material}
        size={80}
        seed={index * 13.7}
        level={level}
        aria-label={`${agent.name}: ${step.state}`}
      />
      <div className="mt-1 w-full">
        <div className="flex items-center justify-center gap-2">
          <span className="font-semibold">{agent.name}</span>
          <span className="text-xs text-muted-foreground">{agent.role}</span>
        </div>
        <Badge className="mt-2 font-mono" style={{ borderColor: agent.color }}>
          {step.state}
        </Badge>
        <p className="mt-2 min-h-10 text-xs text-muted-foreground" aria-live="polite">
          {step.text}
        </p>
      </div>
    </Card>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="mt-16">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">{description}</p>
      {children}
    </section>
  );
}

function Footer() {
  return (
    <footer className="mt-20 flex flex-wrap items-center justify-between gap-2 border-t pt-6 text-sm text-muted-foreground">
      <span>MIT © Wahab Shaikh</span>
      <span>2D canvas · spring-mass physics · zero runtime dependencies</span>
    </footer>
  );
}
