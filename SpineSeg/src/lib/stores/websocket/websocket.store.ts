// lib/websocketStore.ts
import { writable } from 'svelte/store';
import type { SocketState, SocketStore } from './websocket.type';

export function createSocket(
  url: string, 
  onopen = (self: any) => {}, 
  onmessage = (self: any, data: any) => {}, 
  onclose = (self: any, event: CloseEvent) => {}
): SocketStore {
  const { subscribe, update } = writable<SocketState>({
    status: 'disconnected',
    lastMessage: null,
    retries: 0
  });
  
  let socket: WebSocket | null = null;
  let reconnectTimeout: ReturnType<typeof setTimeout>;
  let delayM = 0;
  let forcedClose = false;

  // 1. Define the API object first so it's "hoisted" in the closure
  const api = {
    subscribe,
    send: (data: any) => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(data));
      }
    },
    close: () => {
      forcedClose = true;
      clearTimeout(reconnectTimeout);
      socket?.close();
    }
  };

  function connect() {
    forcedClose = false;
    socket = new WebSocket(url);

    socket.onopen = () => {
      update(s => ({ ...s, status: 'open', retries: 0 }));
      // 2. Pass 'api' as self
      onopen(api);
      clearTimeout(reconnectTimeout);
      delayM = 0;
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        update(s => ({ ...s, lastMessage: data }));
        onmessage(api, data);
      } catch (e) {}
    };

    socket.onclose = (event) => {
      update(s => ({ ...s, status: 'disconnected' }));
      
      // 3. Pass 'api' to onclose.
      onclose(api, event);
      
      if (!forcedClose) {
        const delay = Math.min(1000 * Math.pow(2, delayM), 30000);
        delayM++;
        reconnectTimeout = setTimeout(() => {
          update(s => ({ ...s, status: 'reconnecting', retries: s.retries + 1 }));
          connect();
        }, delay);
      }
    };

    socket.onerror = () => socket?.close();
  }

  connect();

  return api;
}