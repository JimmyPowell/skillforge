"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface RunStatusState {
  phase: string;
  message: string;
  isConnected: boolean;
}

export function useRunStatus(runId: string | null): RunStatusState {
  const [phase, setPhase] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef<boolean>(true);

  const connect = useCallback(() => {
    if (!runId || !mountedRef.current) return;

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const ws = new WebSocket(`ws://localhost:8000/ws/runs/${runId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (mountedRef.current) {
        setIsConnected(true);
      }
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const data = JSON.parse(event.data);
        if (data.phase) setPhase(data.phase);
        if (data.message) setMessage(data.message);
      } catch {
        // Ignore non-JSON messages
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setIsConnected(false);
      // Auto-reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current && runId) {
          connect();
        }
      }, 3000);
    };

    ws.onerror = () => {
      if (!mountedRef.current) return;
      ws.close();
    };
  }, [runId]);

  useEffect(() => {
    mountedRef.current = true;

    // Reset state when runId changes
    setPhase("");
    setMessage("");
    setIsConnected(false);

    if (runId) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [runId, connect]);

  return { phase, message, isConnected };
}
