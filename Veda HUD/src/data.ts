import type { ActivityEvent, Task } from './types';

export const initialTasks: Task[] = [
  { id: 'task-1', title: 'Complete hackathon project', done: false, createdAt: Date.now() },
  { id: 'task-2', title: 'Study quantum computing', done: false, createdAt: Date.now() },
  { id: 'task-3', title: 'Prepare for session 2026', done: false, createdAt: Date.now() },
];

export const initialActivity: ActivityEvent[] = [
  { id: 'a1', message: 'Systems online and calibrated', time: '12:43:08', kind: 'success' },
  { id: 'a2', message: 'Synced your local task list', time: '12:42:51', kind: 'system' },
  { id: 'a3', message: 'Waiting for your next command', time: '12:42:32', kind: 'system' },
];

export const mockMetrics = [
  { label: 'CPU', value: 18, unit: '%', color: 'cyan' },
  { label: 'RAM', value: 42, unit: '%', color: 'blue' },
  { label: 'GPU', value: 12, unit: '%', color: 'cyan' },
  { label: 'TEMP', value: 49, unit: '°C', color: 'amber' },
];
