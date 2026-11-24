import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity, ArrowUpRight, Bell, Bot, Check, ChevronRight, CircleHelp,
  Command, FileCode2, Globe2, Headphones, History, LayoutGrid, Lightbulb, ListTodo,
  Maximize2, Mic, MicOff, MoreHorizontal, Plus, Radio, RotateCcw, Search, Send, Settings2,
  ShieldCheck, Sparkles, Volume2, VolumeX, X, Zap,
} from 'lucide-react';
import { useAssistant } from './hooks/useAssistant';
import WeatherWidget from './components/WeatherWidget';
import { mockMetrics } from './data';
import type { Quality, Task } from './types';

const VEDAScene = lazy(() => import('./components/scene/VEDAScene'));

type DrawerKind = 'settings' | 'activity' | 'notifications' | 'tasks' | 'chat' |'history'| 'action' | null;
type ActionKind = 'browse' | 'code' | 'apps' | 'search' | 'reminder' | 'devices';
type Preferences = { quality: Quality; reducedMotion: boolean; sound: boolean };
type SpeechAlternative = { transcript: string };
type SpeechEvent = Event & { results: ArrayLike<ArrayLike<SpeechAlternative>> };
type Recognition = {
  continuous: boolean; interimResults: boolean; lang: string;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: Event & { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

const readPreferences = (): Preferences => {
  const defaults: Preferences = { quality: 'balanced', reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, sound: false };
  try { return { ...defaults, ...JSON.parse(localStorage.getItem('veda-prefs-v1') || '{}') } as Preferences; }
  catch { return defaults; }
};
const fmtTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

function BrandMark() {
  return (
    <div className="brand-lockup">
      <div className="brand-glyph">
        <strong>RP</strong>
      </div>
      <div className="brand-type">
        <strong>RP SMART</strong>
        <small>THINK � ASSIST � EMPOWER</small>
      </div>
    </div>
  );
}

function Panel({ title, eyebrow, icon, children, className = '', action }: { title: string; eyebrow?: string; icon?: ReactNode; children: ReactNode; className?: string; action?: ReactNode }) {
  return <section className={`hud-panel ${className}`}>
    <div className="panel-heading">
      <div className="panel-title-stack"><span className="panel-icon">{icon}</span><div>{eyebrow && <span className="panel-eyebrow">{eyebrow}</span>}<h2>{title}</h2></div></div>
      {action}
    </div>
    {children}
    <span className="panel-corner corner-tl" /><span className="panel-corner corner-br" />
  </section>;
}


function StatusPanel() {
  const [readings, setReadings] = useState<Record<string, number | null>>({});

  useEffect(() => {
    let active = true;

    const fetchTelemetry = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/telemetry');
        if (!response.ok) throw new Error('Telemetry unavailable');

        const data = await response.json();

        if (active) {
          setReadings({
            CPU: data.cpu,
            RAM: data.ram,
            GPU: data.gpu,
            TEMP: data.temperature
          });
        }
      } catch (error) {
        console.error('Telemetry error:', error);
      }
    };

    fetchTelemetry();
    const timer = window.setInterval(fetchTelemetry, 2000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <Panel title="System status" eyebrow="LIVE TELEMETRY" icon={<Activity size={14} />} className="status-panel">
      <div className="gauges-row">
        {mockMetrics.map(metric => {
          const value = readings[metric.label] ?? null;

          return (
            <div className={`metric-gauge ${metric.color}`} key={metric.label}>
              <div
                className="gauge-ring"
                style={{ '--progress': `${(value ?? 0) * 3.6}deg` } as CSSProperties}
              >
                <div>
                  <strong>{value === null ? '--' : Math.round(value)}</strong>
                  <small>{metric.unit}</small>
                </div>
              </div>
              <span>{metric.label}</span>
            </div>
          );
        })}
      </div>
      <div className="telemetry-note">
        <span className="tiny-pulse" /> Live device telemetry � Refreshing every 2 seconds
      </div>
    </Panel>
  );
}

function GreetingPanel({ onChat }: { onChat: () => void }) {
  return <Panel title="Hello, I'm RP SMART." eyebrow="YOUR AI COMPANION" icon={<Sparkles size={14} />} className="greeting-panel">
    <p className="greeting-accent">How can I assist you today?</p>
    <div className="greeting-footer"><span><span className="tiny-pulse" /> Ready to listen</span><button className="text-action" onClick={onChat}>Start a conversation <ChevronRight size={13} /></button></div>
  </Panel>;
}

function ActivityPanel({ items, onOpen }: { items: ReturnType<typeof useAssistant>['activity']; onOpen: () => void }) {
  const visible = items.slice(0, 3);
  return <Panel title="Live activity" eyebrow="RECENT EVENTS" icon={<Radio size={14} />} className="activity-panel" action={<button className="panel-link" onClick={onOpen}>View all <ChevronRight size={13} /></button>}>
    <div className="activity-list">{visible.map(item => <div className="activity-row" key={item.id}><span className={`activity-dot ${item.kind}`} /><span className="activity-message">{item.message}</span><time>{item.time}</time></div>)}</div>
    <div className="activity-equalizer" aria-hidden="true">{Array.from({ length: 28 }, (_, i) => <i key={i} style={{ '--bar': `${12 + (i * 13 % 31)}px`, '--delay': `${(i % 9) * -0.17}s` } as CSSProperties} />)}</div>
  </Panel>;
}

function InsightsPanel() {
  const bars = useMemo(() => Array.from({ length: 24 }, (_, i) => 17 + ((i * 29 + 11) % 61)), []);
  return <Panel title="AI insights" eyebrow="WEEKLY FOCUS · DEMO DATA" icon={<Lightbulb size={14} />} className="insights-panel" action={<span className="insight-trend"><ArrowUpRight size={12} /> 18%</span>}>
    <div className="insight-summary"><strong>You're in flow.</strong><span>Focus time is up this week.</span></div>
    <div className="insight-chart" aria-label="Simulated weekly focus chart">{bars.map((height, i) => <i key={i} style={{ height: `${height}%`, opacity: .42 + (i / bars.length) * .5, '--chart-index': i } as CSSProperties} />)}</div>
    <div className="chart-labels"><span>MON</span><span>WED</span><span>FRI</span><span>SUN</span></div>
  </Panel>;
}

const quickItems: { id: ActionKind; label: string; icon: ReactNode; detail: string }[] = [
  { id: 'browse', label: 'Browse web', icon: <Globe2 size={15} />, detail: 'Open a local web search demo' },
  { id: 'code', label: 'Run code', icon: <FileCode2 size={15} />, detail: 'Open the code sandbox demo' },
  { id: 'apps', label: 'Open apps', icon: <LayoutGrid size={15} />, detail: 'Open the app launcher' },
  { id: 'search', label: 'Search info', icon: <Search size={15} />, detail: 'Search this VEDA demo' },
  { id: 'reminder', label: 'Set reminder', icon: <ListTodo size={15} />, detail: 'Add a task to your local list' },
  { id: 'devices', label: 'Control devices', icon: <Zap size={15} />, detail: 'Toggle simulated room controls' },
];

function QuickAccess({ onAction }: { onAction: (action: ActionKind) => void }) {
  return <Panel title="Quick access" eyebrow="COMMAND DECK" icon={<Zap size={14} />} className="quick-panel">
    <div className="quick-grid">{quickItems.map(item => <button key={item.id} className="quick-button" title={item.detail} onClick={() => onAction(item.id)}><span>{item.icon}</span><small>{item.label}</small><ChevronRight size={11} className="quick-arrow" /></button>)}</div>
  </Panel>;
}

function TasksPanel({ tasks, onToggle, onRemove, onOpen, onAdd }: { tasks: Task[]; onToggle: (id: string) => void; onRemove: (id: string) => void; onOpen: () => void; onAdd: () => void }) {
  const active = tasks.filter(task => !task.done).slice(0, 3);
  return <Panel title="Upcoming tasks" eyebrow={`${tasks.filter(task => !task.done).length} OPEN`} icon={<ListTodo size={14} />} className="tasks-panel" action={<button className="panel-link" onClick={onOpen}>View all <ChevronRight size={13} /></button>}>
    <div className="task-list">{active.length ? active.map(task => <div className="task-row" key={task.id}>
      <button className="task-check" aria-label={`Complete ${task.title}`} onClick={() => onToggle(task.id)}><Check size={11} /></button>
      <span onClick={() => onToggle(task.id)}>{task.title}</span>
      <button className="task-remove" title="Remove task" onClick={() => onRemove(task.id)}><X size={12} /></button>
    </div>) : <p className="empty-inline">All caught up. Add a task to get started.</p>}</div>
    <button className="add-task-link" onClick={onAdd}><Plus size={13} /> Add a task</button>
  </Panel>;
}

function Waveform({ mode, level }: { mode: string; level: number }) {
  return <div className={`waveform ${mode}`} aria-hidden="true">{Array.from({ length: 21 }, (_, i) => {
    const variation = Math.sin(i * 1.9) * .5 + .5;
    return <i key={i} style={{ '--wave': `${7 + variation * (mode === 'listening' ? 25 + level * 28 : mode === 'thinking' ? 18 : mode === 'speaking' ? 22 : 9)}px`, '--delay': `${i * 24}ms` } as CSSProperties} />;
  })}</div>;
}

function Drawer({ kind, onClose, assistant, onSubmitPrompt, openChat, prefs, setPrefs, devices, setDevices, searchText, setSearchText, reminderText, setReminderText, onReminder, toast }: {
  kind: DrawerKind; onClose: () => void; assistant: ReturnType<typeof useAssistant>; onSubmitPrompt: (text: string) => void;
  openChat: () => void; prefs: Preferences; setPrefs: (prefs: Preferences) => void;
  devices: { lights: boolean; climate: boolean; audio: boolean }; setDevices: (devices: { lights: boolean; climate: boolean; audio: boolean }) => void;
  searchText: string; setSearchText: (value: string) => void; reminderText: string; setReminderText: (value: string) => void; onReminder: (event: FormEvent) => void; toast: string;
}) {
  const [codeRan, setCodeRan] = useState(false);
  const [selectedApp, setSelectedApp] = useState('');
  const titles: Record<Exclude<DrawerKind, null>, string> = { settings: 'System settings', activity: 'Activity timeline', notifications: 'Notifications', tasks: 'Task board', chat: 'Conversation', history: 'Conversation History', action: 'Command deck' };
  const action = kind === 'action' ? toast.split('|')[0] as ActionKind : null;
  useEffect(() => { setCodeRan(false); setSelectedApp(''); }, [kind, action]);
  const apps = ['VEDA Assistant', 'Focus Studio', 'Knowledge Archive', 'System Monitor'];

  return <AnimatePresence>{kind && <>
    <motion.button className="drawer-scrim" aria-label="Close panel" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
    <motion.aside className={`drawer ${kind === 'chat' ? 'chat-drawer' : ''}`} role="dialog" aria-modal="true" aria-label={titles[kind]} initial={{ x: '104%', opacity: .8 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '104%', opacity: .8 }} transition={{ type: 'spring', stiffness: 280, damping: 30 }}>
      <div className="drawer-head"><div><span className="drawer-kicker">VEDA / CONTROL INTERFACE</span><h2>{titles[kind]}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
      <div className="drawer-content">
        {kind === 'settings' && <>
          <div className="setting-group"><span className="setting-label">RENDER QUALITY</span><p>Balance detail and frame rate.</p><div className="segmented">{(['high', 'balanced', 'performance'] as Quality[]).map(value => <button key={value} className={prefs.quality === value ? 'selected' : ''} onClick={() => setPrefs({ ...prefs, quality: value })}>{value}</button>)}</div></div>
          <Toggle title="Reduced motion" caption="Slow scene animations and ambient movement." checked={prefs.reducedMotion} onChange={() => setPrefs({ ...prefs, reducedMotion: !prefs.reducedMotion })} />
          <Toggle title="Sound responses" caption="Speak local demo responses using browser speech." checked={prefs.sound} onChange={() => setPrefs({ ...prefs, sound: !prefs.sound })} />
          <div className="setting-footnote"><ShieldCheck size={15} /><span>Voice is opt-in. Mock responses and simulated readings stay in this frontend demo.</span></div>
        </>}
        {kind === 'activity' && <div className="timeline-list">{assistant.activity.map((item, i) => <div className="timeline-row" key={item.id}><div className={`timeline-icon ${item.kind}`}>{item.kind === 'success' ? <Check size={14} /> : <Activity size={14} />}</div><div><p>{item.message}</p><time>{item.time} · local demo</time></div>{i < assistant.activity.length - 1 && <span className="timeline-line" />}</div>)}</div>}
        {kind === 'history' && <>
  <button
    className="primary-button"
      onClick={() => {
  assistant.newChat();
  openChat();
}}
  >
    <Plus size={15} /> New Chat
  </button>

  <div className="drawer-task-list">
    {assistant.isLoadingHistory ? (
      <p>Loading conversations...</p>
    ) : assistant.conversations.length ? (
      assistant.conversations.map(conversation => (
        <button
          key={conversation.id}
          className="drawer-task"
          onClick={() => {
            assistant.loadConversation(conversation.id);
            onClose();
          }}
        >
          <div>
            <span>{conversation.title}</span>
            <small>
              {new Date(
                `${conversation.created_at.replace(' ', 'T')}Z`
              ).toLocaleString()}
            </small>
          </div>
          <ChevronRight size={15} />
        </button>
      ))
    ) : (
      <p>No conversations found.</p>
    )}
  </div>
</>}
        {kind === 'notifications' && <div className="notification-card"><span className="notification-symbol"><Sparkles size={18} /></span><div><b>You're all set.</b><p>VEDA is online in local demo mode. Your task list is saved in this browser.</p><time>{fmtTime()} · Just now</time></div></div>}
        {kind === 'tasks' && <>
          <form className="inline-add-form" onSubmit={onReminder}><input autoFocus placeholder="Add a task or reminder…" value={reminderText} onChange={event => setReminderText(event.target.value)} /><button className="primary-button"><Plus size={15} /> Add</button></form>
          <div className="drawer-task-list">{assistant.tasks.length ? assistant.tasks.map(task => <div className={`drawer-task ${task.done ? 'complete' : ''}`} key={task.id}>
            <button className={`task-check ${task.done ? 'checked' : ''}`} onClick={() => assistant.toggleTask(task.id)} aria-label={task.done ? 'Reopen task' : 'Complete task'}>{task.done && <Check size={12} />}</button>
            <div><span>{task.title}</span><small>{task.done ? 'COMPLETED' : 'IN PROGRESS'}</small></div>
            <button className="icon-button subtle" aria-label="Remove task" onClick={() => assistant.removeTask(task.id)}><X size={14} /></button>
          </div>) : <div className="drawer-empty"><ListTodo size={23} /><p>No tasks yet. Add one above.</p></div>}</div>
        </>}
        {kind === 'chat' && <>
          <div className="chat-context"><span className="tiny-pulse" />RP SMART AI IS ONLINE</div>
          <div className="chat-messages" role="log" aria-live="polite">
            {!assistant.messages.length && <div className="chat-welcome"><span className="chat-veda-mark">RP</span><b>Namaste. I'm here.</b><p>Ask me something, or try How are my tasks?</p><button onClick={() => onSubmitPrompt('How are my tasks?')}>How are my tasks? <ChevronRight size={13} /></button></div>}
            {assistant.messages.map((message) => <motion.div key={message.id} className={`message ${message.role}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}><span className="message-avatar">{message.role === 'veda' ? 'RP' : 'YOU'}</span><div><p>{message.text}</p><time>{message.time} {message.role === 'veda' && <span>· RP SMART</span>}</time></div></motion.div>)}
            {assistant.isGenerating && <div className="thinking-indicator"><i /><i /><i /> RP SMART is responding...</div>}
          </div>
                    <form className="chat-form" onSubmit={event => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const value = String(data.get('prompt') || '');
            if (value.trim() && !assistant.isGenerating) {
              onSubmitPrompt(value);
              event.currentTarget.reset();
            }
          }}>
            <input
              autoFocus
              name="prompt"
              placeholder="Message RP SMART..."
              aria-label="Message RP SMART"
              disabled={assistant.isGenerating}
            />
            {assistant.isGenerating ? (
              <button type="button" aria-label="Stop generation" onClick={assistant.stopGeneration}>
                <span>{"\u25A0"}</span>
              </button>
            ) : (
              <button type="submit" aria-label="Send message">
                <Send size={16} />
              </button>
            )}
          </form>
          <p className="chat-disclaimer">Powered by RP SMART AI · Live response</p>
        </>}
        {kind === 'action' && action === 'browse' && <div className="action-content"><div className="demo-banner"><Globe2 size={18} /><div><b>Web search preview</b><span>Simulated · no external request is sent</span></div></div><form className="action-search" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); setSearchText(String(data.get('q') || '')); }}><Search size={16} /><input name="q" defaultValue={searchText} placeholder="What would you like to explore?" /><button><ArrowUpRight size={15} /></button></form>{searchText ? <div className="mock-result"><span className="result-kicker">LOCAL DEMO RESULT</span><h3>{searchText}</h3><p>Web browsing is not connected yet. In a live VEDA build, this is where a connected search service would return sources and summaries.</p><span>Frontend placeholder · 0 external sources</span></div> : <p className="action-hint">Try “latest space discoveries” to see the search preview.</p>}</div>}
        {kind === 'action' && action === 'search' && <div className="action-content"><div className="demo-banner"><Search size={18} /><div><b>Search VEDA</b><span>Find a task or demo activity</span></div></div><form className="action-search" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); setSearchText(String(data.get('q') || '')); }}><Search size={16} /><input name="q" defaultValue={searchText} placeholder="Search tasks…" /><button><ArrowUpRight size={15} /></button></form>{searchText && <div className="search-results">{assistant.tasks.filter(task => task.title.toLowerCase().includes(searchText.toLowerCase())).map(task => <div key={task.id}><ListTodo size={14} /><span>{task.title}</span><small>TASK</small></div>)}{assistant.activity.filter(item => item.message.toLowerCase().includes(searchText.toLowerCase())).map(item => <div key={item.id}><Activity size={14} /><span>{item.message}</span><small>ACTIVITY</small></div>)}{!assistant.tasks.some(task => task.title.toLowerCase().includes(searchText.toLowerCase())) && !assistant.activity.some(item => item.message.toLowerCase().includes(searchText.toLowerCase())) && <p>No matching tasks or activities.</p>}</div>}</div>}
        {kind === 'action' && action === 'code' && <div className="action-content"><div className="demo-banner"><FileCode2 size={18} /><div><b>Code console</b><span>Safe preview · code execution is simulated</span></div></div><div className="code-window"><div className="code-toolbar"><span><i /><i /><i /></span><small>hello-veda.js</small><MoreHorizontal size={16} /></div><pre><span className="code-muted">// A tiny frontend demo</span>{'\n'}const greeting = <span className="code-gold">"Namaste, VEDA"</span>;{'\n'}console.log(greeting);</pre>{codeRan && <div className="code-output"><span>OUTPUT</span><p><span>›</span> Namaste, VEDA</p><small>Completed in local demo</small></div>}</div><button className="primary-button run-button" onClick={() => setCodeRan(true)}><Zap size={14} /> {codeRan ? 'Run again' : 'Run sample'}</button></div>}
        {kind === 'action' && action === 'apps' && <div className="app-launcher"><div className="launcher-heading"><div><b>Demo app launcher</b><span>Local interface shortcuts</span></div><span>04 APPS</span></div><div className="launcher-grid">{apps.map((name, i) => <button key={name} onClick={() => setSelectedApp(name)}><span className={`launcher-icon tone-${i}`}><i>{['RP', '?', '?', '?'][i]}</i></span><b>{name}</b><small>{i === 0 ? 'Assistant demo' : 'Frontend preview'}</small></button>)}</div>{selectedApp ? <div className="selected-app-note"><span className="tiny-pulse" /><div><b>{selectedApp}</b><p>{selectedApp === 'VEDA Assistant' ? 'The assistant conversation is available in this demo.' : 'This shortcut is a frontend preview. No external app is connected.'}</p>{selectedApp === 'VEDA Assistant' && <button onClick={openChat}>Open conversation <ChevronRight size={13} /></button>}</div></div> : <p className="action-hint">Select a tile to open its local demo preview.</p>}</div>}
        {kind === 'action' && action === 'reminder' && <div className="action-content"><div className="demo-banner"><ListTodo size={18} /><div><b>Set a reminder</b><span>Saved in your local task list</span></div></div><form className="reminder-form" onSubmit={onReminder}><label htmlFor="reminder-title">WHAT DO YOU NEED TO REMEMBER?</label><input autoFocus id="reminder-title" placeholder="e.g. Review the project brief" value={reminderText} onChange={event => setReminderText(event.target.value)} /><button className="primary-button"><Plus size={15} /> Add reminder</button></form><div className="recent-reminders"><span>UP NEXT</span>{assistant.tasks.filter(task => !task.done).slice(0, 3).map(task => <p key={task.id}><span className="tiny-pulse" /> {task.title}</p>)}</div></div>}
        {kind === 'action' && action === 'devices' && <div className="action-content"><div className="demo-banner"><Zap size={18} /><div><b>Room controls</b><span>Simulated devices · no hardware connected</span></div></div><div className="device-list"><DeviceToggle icon={<Lightbulb size={17} />} title="Ambient lighting" subtitle="Studio · 72% brightness" checked={devices.lights} onChange={() => setDevices({ ...devices, lights: !devices.lights })} /><DeviceToggle icon={<Activity size={17} />} title="Climate system" subtitle="Comfort · 22° C target" checked={devices.climate} onChange={() => setDevices({ ...devices, climate: !devices.climate })} /><DeviceToggle icon={<Headphones size={17} />} title="Audio system" subtitle="Workspace speakers" checked={devices.audio} onChange={() => setDevices({ ...devices, audio: !devices.audio })} /></div></div>}
      </div>
    </motion.aside>
  </> }</AnimatePresence>;
}

function Toggle({ title, caption, checked, onChange }: { title: string; caption: string; checked: boolean; onChange: () => void }) {
  return <div className="setting-toggle"><div><b>{title}</b><p>{caption}</p></div><button className={`switch ${checked ? 'on' : ''}`} role="switch" aria-checked={checked} onClick={onChange}><i /></button></div>;
}
function DeviceToggle({ icon, title, subtitle, checked, onChange }: { icon: ReactNode; title: string; subtitle: string; checked: boolean; onChange: () => void }) {
  return <div className="device-row"><span className="device-icon">{icon}</span><div><b>{title}</b><small>{subtitle}</small></div><button className={`switch ${checked ? 'on' : ''}`} role="switch" aria-checked={checked} onClick={onChange}><i /></button></div>;
}

function App() {
  const assistant = useAssistant();
  const [drawer, setDrawer] = useState<DrawerKind>(null);
  const [activeAction, setActiveAction] = useState<ActionKind>('browse');
  const [prefs, setPrefsState] = useState<Preferences>(readPreferences);
  const [clock, setClock] = useState(fmtTime());
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [focused, setFocused] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [command, setCommand] = useState('');
  const [reminderText, setReminderText] = useState('');
  const [searchText, setSearchText] = useState('');
  const [devices, setDevices] = useState({ lights: true, climate: true, audio: false });
  const recognition = useRef<Recognition | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analysisTimer = useRef<number | null>(null);
  const lastSpokenMessage = useRef('');
  const rootRef = useRef<HTMLDivElement>(null);
  const micSupported = typeof window !== 'undefined' && !!((window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition);
  const releaseVoiceAudio = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop()); streamRef.current = null;
    if (analysisTimer.current) window.clearInterval(analysisTimer.current); analysisTimer.current = null;
    const context = audioContextRef.current; audioContextRef.current = null;
    if (context && context.state !== 'closed') void context.close();
  }, []);

  const setPrefs = useCallback((next: Preferences) => { setPrefsState(next); localStorage.setItem('veda-prefs-v1', JSON.stringify(next)); }, []);
  const closeDrawer = useCallback(() => setDrawer(null), []);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(fmtTime()), 1000);
    const onVisibility = () => {
      if (!document.hidden) return;
      recognition.current?.stop();
      releaseVoiceAudio();
      assistant.setListeningLevel(0);
      assistant.setMode(mode => mode === 'listening' ? 'idle' : mode);
    };
    const onOnline = () => assistant.setMode(mode => mode === 'offline' ? 'idle' : mode);
    const onOffline = () => { assistant.setMode('offline'); assistant.log('Browser connection unavailable', 'warning'); };
    if (!navigator.onLine) assistant.setMode('offline');
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [assistant.log, assistant.setListeningLevel, assistant.setMode, releaseVoiceAudio]);

  useEffect(() => { localStorage.setItem('veda-prefs-v1', JSON.stringify(prefs)); }, [prefs]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (assistant.messages.length) {
      const latest = assistant.messages.at(-1);
      if (latest?.role === 'veda' && latest.id !== lastSpokenMessage.current && prefs.sound && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(latest.text); utterance.rate = .97; utterance.pitch = 1.04;
        window.speechSynthesis.speak(utterance);
      }
      if (latest?.role === 'veda') lastSpokenMessage.current = latest.id;
    }
  }, [assistant.messages, prefs.sound]);
  useEffect(() => { if (!prefs.sound) window.speechSynthesis?.cancel(); }, [prefs.sound]);
  useEffect(() => () => {
    recognition.current?.stop(); releaseVoiceAudio();
    window.speechSynthesis?.cancel();
  }, [releaseVoiceAudio]);

  const submitPrompt = useCallback((text: string) => { assistant.respond(text); setDrawer('chat'); }, [assistant]);

  const activateVoice = useCallback(async () => {
    if (assistant.mode === 'listening') {
      recognition.current?.stop(); releaseVoiceAudio();
      assistant.setMode('idle'); assistant.log('Voice input stopped'); return;
    }
    if (!micSupported) {
      assistant.setMode('error'); assistant.log('Speech recognition is unavailable in this browser', 'warning');
      setToast('Speech recognition is not supported here. You can still type below.');
      window.setTimeout(() => assistant.setMode('idle'), 2400); return;
    }
    const Speech = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!Speech) return;
    try {
      assistant.setMode('listening'); assistant.setListeningLevel(0); assistant.log('Microphone activated by user', 'success');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); streamRef.current = stream;
        const audioContext = new AudioContext(); audioContextRef.current = audioContext;
        const analyser = audioContext.createAnalyser(); analyser.fftSize = 256;
        audioContext.createMediaStreamSource(stream).connect(analyser);
        const samples = new Uint8Array(analyser.frequencyBinCount);
        analysisTimer.current = window.setInterval(() => { analyser.getByteFrequencyData(samples); assistant.setListeningLevel(samples.reduce((sum, n) => sum + n, 0) / samples.length / 128); }, 90);
      } catch { /* SpeechRecognition can still work without analyser access. */ }
      const instance = new Speech(); instance.continuous = false; instance.interimResults = false; instance.lang = 'en-IN';
      instance.onresult = event => {
        const transcript = event.results[0]?.[0]?.transcript || '';
        releaseVoiceAudio();
        if (transcript) { assistant.setMode('thinking'); assistant.setListeningLevel(0); submitPrompt(transcript); }
      };
      instance.onerror = event => {
        releaseVoiceAudio();
        assistant.setMode('error'); assistant.log(`Voice input error${event.error ? `: ${event.error}` : ''}`, 'warning');
        setToast('Voice input ended. You can continue with text.');
        window.setTimeout(() => assistant.setMode('idle'), 2600);
      };
      instance.onend = () => { releaseVoiceAudio(); assistant.setListeningLevel(0); assistant.setMode(current => current === 'listening' ? 'idle' : current); };
      recognition.current = instance; instance.start();
    } catch {
      releaseVoiceAudio(); assistant.setMode('error');
      assistant.log('Microphone permission was unavailable', 'warning'); setToast('Microphone unavailable. Check browser permissions or type a message.');
      window.setTimeout(() => assistant.setMode('idle'), 2600);
    }
  }, [assistant, micSupported, releaseVoiceAudio, submitPrompt]);

  const openAction = (action: ActionKind) => {
    setActiveAction(action); setSearchText(''); setFocused(action === 'reminder' ? 'right-bottom' : 'right-middle'); setDrawer('action');
    assistant.log(`${quickItems.find(item => item.id === action)?.label ?? 'Quick action'} opened`);
  };
  const addReminder = (event: FormEvent) => {
    event.preventDefault(); if (!reminderText.trim()) return;
    assistant.addTask(reminderText); setReminderText(''); setToast('Reminder added to your local task list.');
    if (activeAction !== 'reminder' && drawer !== 'tasks') setDrawer('tasks');
  };
  const submitCommand = (event: FormEvent) => { event.preventDefault(); if (!command.trim()) return; const text = command; setCommand(''); submitPrompt(text); };
  const toggleFullscreen = async () => {
    try { if (!document.fullscreenElement) await rootRef.current?.requestFullscreen(); else await document.exitFullscreen(); }
    catch { setToast('Full-screen mode is unavailable in this window.'); }
  };
  const resetCamera = () => { setFocused(null); setParallax({ x: 0, y: 0 }); setToast('View centered'); };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (prefs.reducedMotion || window.matchMedia('(max-width: 760px)').matches) return;
    setParallax({ x: (event.clientX / window.innerWidth - .5) * 2, y: (event.clientY / window.innerHeight - .5) * 2 });
  };
  const openPanel = (panel: Exclude<DrawerKind, null>, focus: string | null = null) => { setFocused(focus); setDrawer(panel); };
  const modeLabel: Record<string, string> = { idle: 'System online', listening: 'Listening', thinking: 'Processing', speaking: 'Responding', success: 'Task complete', error: 'Voice unavailable', offline: 'Offline' };

  return <main ref={rootRef} className={`app-shell mode-${assistant.mode} quality-${prefs.quality} ${prefs.reducedMotion ? 'reduced-motion' : ''}`} onPointerMove={onPointerMove}>
    <div className="scene-wrap"><Suspense fallback={<div className="scene-fallback" aria-hidden="true" />}><VEDAScene mode={assistant.mode} quality={prefs.quality} reducedMotion={prefs.reducedMotion} focused={focused} parallax={parallax} sound={prefs.sound} /></Suspense></div>
    <div className="environment-vignette" /><div className="scanlines" />
    <header className="topbar">
      <button className="brand-button" onClick={resetCamera} aria-label="Center VEDA view"><BrandMark /></button>
      <div className="topbar-center"><span className="topbar-eyebrow">VIRTUAL ENHANCED DIGITAL ASSISTANT</span><div className="online-status"><span className="tiny-pulse" />{modeLabel[assistant.mode]} <small>· FRONTEND DEMO</small></div></div>
      <div className="topbar-right"><div className="clock-block"><span>{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}</span><strong>{clock}<small> IST</small></strong></div>
        <button className={`top-icon ${prefs.sound ? 'enabled' : ''}`} title={prefs.sound ? 'Mute voice responses' : 'Enable voice responses'} onClick={() => setPrefs({ ...prefs, sound: !prefs.sound })}>{prefs.sound ? <Volume2 size={16} /> : <VolumeX size={16} />}</button>
        <button
  className="top-icon"
  title="Conversation history"
  onClick={() => {
    void assistant.loadConversations();
    openPanel('history');
  }}
>
<History size={16} />
</button>
        <button className="top-icon notification-trigger" title="Notifications" onClick={() => openPanel('notifications')}><Bell size={16} /><i /></button>
        <button className="top-icon" title="Settings" onClick={() => openPanel('settings')}><Settings2 size={16} /></button>
        <button className="top-icon fullscreen-trigger" title="Toggle full screen" onClick={toggleFullscreen}><Maximize2 size={15} /></button>
      </div>
    </header>

    <div className="corner-coords left-coords"><span>21° 09′ 48.2″ N</span><span>72° 47′ 54.1″ E</span></div>
    <div className="corner-coords right-coords"><span>RP SMART <b>01</b></span><span>SECURE LOCAL SESSION</span></div>

    <aside className="left-rail" onMouseEnter={() => setFocused('left-top')} onMouseLeave={() => setFocused(null)}>
      <GreetingPanel onChat={() => openPanel('chat', 'left-top')} />
      <WeatherWidget />
      <ActivityPanel items={assistant.activity} onOpen={() => openPanel('activity', 'left-bottom')} />
      <InsightsPanel />
    </aside>

    <aside className="right-rail" onMouseEnter={() => setFocused('right-top')} onMouseLeave={() => setFocused(null)}>
      <StatusPanel />
      <QuickAccess onAction={openAction} />
      <TasksPanel tasks={assistant.tasks} onToggle={assistant.toggleTask} onRemove={assistant.removeTask} onOpen={() => openPanel('tasks', 'right-bottom')} onAdd={() => openAction('reminder')} />
    </aside>

    <div className="central-labels"><span className="core-status"><i /> INTELLIGENCE CORE <b>· {modeLabel[assistant.mode].toUpperCase()}</b></span><span className="core-coords">01 / RP SMART · BHARAT</span></div>
    <div className="orbital-readout readout-left"><span>NEURAL LINK</span><b>ACTIVE <i /></b><small>SECURE · LOCAL</small></div>
    <div className="orbital-readout readout-right"><span>THINKING ENGINE</span><b><span>•</span> STANDBY</b><small>BUILD 01.26.11</small></div>

    <section className="command-dock" aria-label="RP SMART voice and command controls">
      <div className="dock-topline"><span>VOICE COMMAND INTERFACE</span><span className={`voice-state ${assistant.mode}`}>{assistant.mode === 'listening' ? '● LISTENING' : assistant.mode === 'thinking' ? '◌ PROCESSING' : assistant.mode === 'error' ? '▲ CHECK INPUT' : '● VOICE READY'}</span></div>
      <form className="command-form" onSubmit={submitCommand}>
        <button type="button" className={`mic-button ${assistant.mode === 'listening' ? 'listening' : ''}`} onClick={activateVoice} title={assistant.mode === 'listening' ? 'Stop listening' : 'Activate microphone'} aria-label={assistant.mode === 'listening' ? 'Stop listening' : 'Activate microphone'}>{assistant.mode === 'listening' ? <MicOff size={19} /> : <Mic size={19} />}<span className="mic-pulse" /></button>
        <div className="command-input-wrap"><div className="dock-wave"><Waveform mode={assistant.mode} level={assistant.listeningLevel} /></div><input value={command} onChange={event => setCommand(event.target.value)} placeholder={assistant.mode === 'listening' ? 'I’m listening…' : 'Speak or type your command'} aria-label="Type a command for RP SMART" /><kbd>↵</kbd></div>
        <button className="send-command" title="Send command" aria-label="Send command"><Send size={16} /></button>
      </form>
      <div className="dock-bottom"><button onClick={() => openPanel('chat')}><Command size={11} /> CHAT</button><span>PRESS THE MIC TO SPEAK <i /> TYPE TO SEND</span><button onClick={resetCamera}><RotateCcw size={11} /> RESET VIEW</button></div>
    </section>

    <div className="mobile-actions"><button onClick={() => openAction('apps')}><LayoutGrid size={16} /> Quick actions</button><button onClick={() => openPanel('tasks')}><ListTodo size={16} /> Tasks <b>{assistant.tasks.filter(task => !task.done).length}</b></button><button onClick={() => openPanel('chat')}><Bot size={16} /> Chat</button></div>
    <div className="quality-chip"><span className="tiny-pulse" /> {prefs.quality.toUpperCase()} QUALITY <span>· DEMO</span></div>
    <button className="settings-fab" title="System settings" onClick={() => openPanel('settings')}><Settings2 size={17} /></button>

    <AnimatePresence>{assistant.messages.length > 0 && drawer !== 'chat' && <motion.button className="conversation-peek" onClick={() => openPanel('chat')} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}><span className="peek-icon"><Bot size={14} /></span><span><b>{assistant.messages.at(-1)?.role === 'veda' ? 'VEDA replied' : 'You sent a message'}</b><small>{assistant.messages.at(-1)?.text.slice(0, 62)}</small></span><ChevronRight size={15} /></motion.button>}</AnimatePresence>
    <AnimatePresence>{toast && toast.includes('|') === false && <motion.div className="toast-message" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}><CircleHelp size={15} />{toast}<button onClick={() => setToast('')}><X size={14} /></button></motion.div>}</AnimatePresence>

    <Drawer kind={drawer} onClose={closeDrawer} assistant={assistant} onSubmitPrompt={submitPrompt} openChat={() => setDrawer('chat')} prefs={prefs} setPrefs={setPrefs} devices={devices} setDevices={setDevices} searchText={searchText} setSearchText={setSearchText} reminderText={reminderText} setReminderText={setReminderText} onReminder={addReminder} toast={`${activeAction}|${quickItems.find(item => item.id === activeAction)?.label ?? ''}`} />
  </main>;
}

export default App;





