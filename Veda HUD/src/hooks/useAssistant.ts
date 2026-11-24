
import { useCallback, useEffect, useRef, useState } from 'react';
import { initialActivity, initialTasks } from '../data';
import type { ActivityEvent, AssistantMode, Message, Task } from '../types';

const API_URL = 'http://127.0.0.1:8000';

const readTasks = (): Task[] => {
  try {
    const saved = localStorage.getItem('veda-tasks-v1');
    return saved ? JSON.parse(saved) as Task[] : initialTasks;
  } catch {
    return initialTasks;
  }
};

const stamp = () =>
  new Date().toLocaleTimeString([], {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

type StreamEvent = {
  type: 'start' | 'delta' | 'done' | 'error';
  text?: string;
  conversation_id?: number;
  message?: string;
};

export function useAssistant() {
  const [mode, setMode] = useState<AssistantMode>('idle');
  const [tasks, setTasks] = useState<Task[]>(readTasks);
  const [activity, setActivity] = useState<ActivityEvent[]>(initialActivity);
  const [messages, setMessages] = useState<Message[]>([]);
  const [listeningLevel, setListeningLevel] = useState(0);

  const [conversationId, setConversationId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isGeneratingRef = useRef(false);

  useEffect(() => {
    localStorage.setItem('veda-tasks-v1', JSON.stringify(tasks));
  }, [tasks]);

  const log = useCallback((
    message: string,
    kind: ActivityEvent['kind'] = 'system'
  ) => {
    setActivity(items => [
      { id: crypto.randomUUID(), message, time: stamp(), kind },
      ...items
    ].slice(0, 10));
  }, []);

  const addTask = useCallback((title: string) => {
    const clean = title.trim();
    if (!clean) return;

    setTasks(items => [
      {
        id: crypto.randomUUID(),
        title: clean,
        done: false,
        createdAt: Date.now()
      },
      ...items
    ]);

    log(`Task added: ${clean}`, 'success');
  }, [log]);

  const toggleTask = useCallback((id: string) => {
    setTasks(items =>
      items.map(task =>
        task.id === id ? { ...task, done: !task.done } : task
      )
    );
  }, []);

  const removeTask = useCallback((id: string) => {
    setTasks(items => items.filter(task => task.id !== id));
  }, []);

  const loadConversations = useCallback(async () => {
    setIsLoadingHistory(true);

    try {
      const response = await fetch(`${API_URL}/api/conversations`);

      if (!response.ok) {
        throw new Error('Failed to load conversations');
      }

      const data = await response.json();
      setConversations(data.conversations);
    } catch (error) {
      console.error('Conversation History Error:', error);
      log('Unable to load conversation history', 'warning');
    } finally {
      setIsLoadingHistory(false);
    }
  }, [log]);

  const loadConversation = useCallback(async (id: number) => {
    if (isGeneratingRef.current) return;

    setIsLoadingHistory(true);

    try {
      const response = await fetch(
        `${API_URL}/api/conversations/${id}/messages`
      );

      if (!response.ok) {
        throw new Error('Failed to load conversation');
      }

      const data = await response.json();

      const loadedMessages: Message[] = data.messages.map(
        (item: { role: string; content: string; created_at: string }, index: number) => ({
          id: `${id}-${index}`,
          role: item.role === 'user' ? 'user' : 'veda',
          text: item.content,
          time: new Date(
            `${item.created_at.replace(' ', 'T')}Z`
          ).toLocaleTimeString([], {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })
        })
      );

      setMessages(loadedMessages);
      setConversationId(id);
      setMode('idle');

      log(`Conversation #${id} loaded`, 'success');
    } catch (error) {
      console.error('Load Conversation Error:', error);
      log('Unable to open conversation', 'warning');
    } finally {
      setIsLoadingHistory(false);
    }
  }, [log]);

  const newChat = useCallback(() => {
    if (isGeneratingRef.current) return;

    setConversationId(null);
    setMessages([]);
    setMode('idle');

    log('New conversation started', 'success');
  }, [log]);

  const stopGeneration = useCallback(() => {
    if (!abortControllerRef.current) return;

    abortControllerRef.current.abort();
    abortControllerRef.current = null;
    isGeneratingRef.current = false;

    setMode('idle');
    log('Generation stopped by user', 'warning');
  }, [log]);

  const respond = useCallback(async (prompt: string) => {
    const clean = prompt.trim();

    if (!clean || isGeneratingRef.current) return;

    isGeneratingRef.current = true;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const userId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();

    setMessages(items => [
      ...items,
      {
        id: userId,
        role: 'user',
        text: clean,
        time: stamp()
      },
      {
        id: assistantId,
        role: 'veda',
        text: '',
        time: stamp()
      }
    ]);

    setMode('thinking');
    log(`RP SMART processing: ${clean.slice(0, 42)}`);

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: clean,
          conversation_id: conversationId,
          weather_context: localStorage.getItem('rp-smart-weather') || ''
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Streaming response is not supported.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = '';
      let completed = false;
      let pendingText = '';
      let flushTimer: ReturnType<typeof setTimeout> | null = null;

      const flushPendingText = () => {
        if (flushTimer) clearTimeout(flushTimer);
        flushTimer = null;

        if (!pendingText) return;

        const text = pendingText;
        pendingText = '';

        setMessages(items =>
          items.map(message =>
            message.id === assistantId
              ? { ...message, text: message.text + text }
              : message
          )
        );
      };

      const processEvent = (event: StreamEvent) => {
        if (event.type === 'start' && event.conversation_id) {
          setConversationId(event.conversation_id);
        }

        if (event.type === 'delta' && event.text) {
          pendingText += event.text;

          if (!flushTimer) {
            flushTimer = setTimeout(flushPendingText, 40);
          }

          setMode('speaking');
        }

        if (event.type === 'done') {
          flushPendingText();
          completed = true;
          setMode('idle');
          log('RP SMART response completed', 'success');
        }

        if (event.type === 'error') {
          throw new Error(event.message || 'Streaming failed');
        }
      };

      while (true) {
        const { value, done } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          processEvent(JSON.parse(line) as StreamEvent);
        }
      }

      buffer += decoder.decode();

      if (buffer.trim()) {
        processEvent(JSON.parse(buffer) as StreamEvent);
      }

      flushPendingText();

      if (!completed) {
        throw new Error('Stream ended before completion.');
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      console.error('RP SMART API Error:', error);

      const errorMessage = error instanceof Error
        ? error.message
        : 'Unknown connection error';

      setMessages(items =>
        items.map(message =>
          message.id === assistantId
            ? {
                ...message,
                text: message.text
                  ? `${message.text}\n\n[Error: ${errorMessage}]`
                  : `Unable to connect to RP SMART. ${errorMessage}`
              }
            : message
        )
      );

      setMode('error');
      log('RP SMART connection failed', 'warning');

    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        isGeneratingRef.current = false;
      }
    }
  }, [conversationId, log]);

  return {
    mode,
    setMode,
    tasks,
    activity,
    messages,
    listeningLevel,
    setListeningLevel,
    log,
    addTask,
    toggleTask,
    removeTask,
    respond,
    stopGeneration,
    isGenerating: mode === 'thinking' || mode === 'speaking',
    conversationId,
    conversations,
    isLoadingHistory,
    loadConversations,
    loadConversation,
    newChat
  };
}


