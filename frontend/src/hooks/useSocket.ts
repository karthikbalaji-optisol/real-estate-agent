import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export interface SocketMessage {
  type: 'property_created' | 'property_updated';
  data: Record<string, unknown>;
}

export function useSocket(onMessage: (msg: SocketMessage) => void) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    const socket = io('/', { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('property_created', (data: Record<string, unknown>) => {
      onMessageRef.current({ type: 'property_created', data });
    });

    socket.on('property_updated', (data: Record<string, unknown>) => {
      onMessageRef.current({ type: 'property_updated', data });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return { connected };
}
