import type { Readable } from "svelte/store";

export interface SocketState {
  status: 'disconnected' | 'open' | 'reconnecting';
  lastMessage: any;
  retries: number;
}

export interface SocketStore {
  subscribe: Readable<SocketState>['subscribe'];
  send: (data: any) => void;
  close: () => void;
}