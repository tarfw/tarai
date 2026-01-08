import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BskyAgent } from "@atproto/api";

const BLUESKY_SESSION_KEY = "@tarai_bluesky_session";
const BLUESKY_CONNECTED_KEY = "@tarai_bluesky_connected";

interface BlueskySession {
  accessJwt: string;
  refreshJwt: string;
  handle: string;
  did: string;
}

interface BlueskyAuthContextType {
  isConnected: boolean;
  isLoading: boolean;
  handle: string | null;
  did: string | null;
  agent: BskyAgent | null;
  connect: (handle: string, password: string) => Promise<void>;
  disconnect: () => Promise<void>;
  error: string | null;
}

const BlueskyAuthContext = createContext<BlueskyAuthContextType | undefined>(undefined);

export function BlueskyAuthProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [handle, setHandle] = useState<string | null>(null);
  const [did, setDid] = useState<string | null>(null);
  const [agent, setAgent] = useState<BskyAgent | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize agent
  const initializeAgent = async (session: BlueskySession) => {
    const newAgent = new BskyAgent({
      service: "https://bsky.social",
    });

    try {
      // Use resumeSession for proper session handling
      await newAgent.resumeSession(session);

      setAgent(newAgent);
      setHandle(session.handle);
      setDid(session.did);
      setIsConnected(true);
      setError(null);
    } catch (e) {
      console.error("Failed to initialize agent session", e);
      // Fallback to manual session setting
      newAgent.session = {
        accessJwt: session.accessJwt,
        refreshJwt: session.refreshJwt,
        handle: session.handle,
        did: session.did,
      };

      setAgent(newAgent);
      setHandle(session.handle);
      setDid(session.did);
      setIsConnected(true);
      setError(null);
    }
  };

  // Load saved session on app start
  useEffect(() => {
    (async () => {
      try {
        const savedSession = await AsyncStorage.getItem(BLUESKY_SESSION_KEY);
        if (savedSession) {
          const session: BlueskySession = JSON.parse(savedSession);
          initializeAgent(session);
        }
      } catch (e) {
        console.error("Failed to load Bluesky session", e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const connect = async (handleInput: string, password: string) => {
    try {
      setError(null);
      const loginAgent = new BskyAgent({
        service: "https://bsky.social",
      });

      const response = await loginAgent.login({
        identifier: handleInput,
        password,
      });

      if (!response.success || !loginAgent.session) {
        throw new Error("Connection failed");
      }

      const session: BlueskySession = {
        accessJwt: loginAgent.session.accessJwt,
        refreshJwt: loginAgent.session.refreshJwt,
        handle: loginAgent.session.handle,
        did: loginAgent.session.did,
      };

      await AsyncStorage.setItem(BLUESKY_SESSION_KEY, JSON.stringify(session));
      await AsyncStorage.setItem(BLUESKY_CONNECTED_KEY, "true");
      initializeAgent(session);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Connection failed";
      setError(errorMessage);
      throw e;
    }
  };

  const disconnect = async () => {
    try {
      await AsyncStorage.removeItem(BLUESKY_SESSION_KEY);
      await AsyncStorage.removeItem(BLUESKY_CONNECTED_KEY);
      setIsConnected(false);
      setHandle(null);
      setDid(null);
      setAgent(null);
      setError(null);
    } catch (e) {
      console.error("Failed to disconnect", e);
      setError("Disconnect failed");
    }
  };

  return (
    <BlueskyAuthContext.Provider
      value={{
        isConnected,
        isLoading,
        handle,
        did,
        agent,
        connect,
        disconnect,
        error,
      }}
    >
      {children}
    </BlueskyAuthContext.Provider>
  );
}

export function useBlueskyAuth() {
  const context = useContext(BlueskyAuthContext);
  if (context === undefined) {
    throw new Error("useBlueskyAuth must be used within a BlueskyAuthProvider");
  }
  return context;
}
