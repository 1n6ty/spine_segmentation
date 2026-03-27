// lib/websocketStore.ts
import { writable, get } from 'svelte/store';

export function createSocket(url: string) {
  const { subscribe, update } = writable({
    status: 'disconnected',
    lastMessage: null,
    retries: 0
  });

  let socket: WebSocket | null = null;
  let reconnectTimeout: ReturnType<typeof setTimeout>;
  let delayM = 0;
  let forcedClose = false; // Flag to prevent reconnecting if we intentionally closed it

  function connect() {
    forcedClose = false;
    socket = new WebSocket(url);

    socket.onopen = () => {
      console.log('WebSocket Connected');
      update(s => ({ ...s, status: 'open', retries: 0 }));
      clearTimeout(reconnectTimeout);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        update(s => ({ ...s, lastMessage: data }));
      } catch (e) {
        console.error("Failed to parse socket message", e);
      }
    };

    socket.onclose = (event) => {
      update(s => ({ ...s, status: 'disconnected' }));
      
      // If we didn't call .close() manually, try to reconnect
      if (!forcedClose) {
        const delay = Math.min(1000 * Math.pow(2, delayM), 30000); // Exponential backoff up to 30s
        delayM ++;
        console.log(`Socket closed. Reconnecting in ${delay}ms...`);
        
        reconnectTimeout = setTimeout(() => {
          update(s => ({ ...s, status: 'reconnecting', retries: s.retries + 1 }));
          connect();
        }, delay);
      }
    };

    socket.onerror = (err) => {
      console.error('WebSocket Error:', err);
      socket?.close(); // Trigger the onclose logic
    };
  }

  connect();

  return {
    subscribe,
    send: (data: any) => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(data));
      } else {
        console.warn("Socket not open. Message not sent.");
      }
    },
    close: () => {
      forcedClose = true;
      clearTimeout(reconnectTimeout);
      socket?.close();
    }
  };
}