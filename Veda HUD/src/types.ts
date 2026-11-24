export type AssistantMode = 'idle' | 'listening' | 'thinking' | 'speaking' | 'success' | 'error' | 'offline';
export type Quality = 'high' | 'balanced' | 'performance';
export type Task = { id: string; title: string; done: boolean; createdAt: number };
export type ActivityEvent = { id: string; message: string; time: string; kind: 'system' | 'success' | 'warning' };
export type Message = { id: string; role: 'user' | 'veda'; text: string; time: string };
