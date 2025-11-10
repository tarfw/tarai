# Phase 3: Expo React Native Integration - Implementation Plan

## Overview

Build the Expo React Native app with multi-agent architecture integration for both Store Owner and Customer experiences.

**Goal:** Seamless agent selection, conversational commerce, and offline-first node operations.

---

## Architecture

### App Structure

```
expo-app/
├── app/
│   ├── (store-owner)/
│   │   ├── _layout.tsx
│   │   ├── index.tsx           # Agent selector
│   │   ├── product.tsx         # Product Agent chat
│   │   ├── instance.tsx        # Instance Agent chat
│   │   ├── order.tsx           # Order Agent chat
│   │   ├── service.tsx         # Service Agent chat
│   │   ├── analytics.tsx       # Analytics Agent chat
│   │   └── settings.tsx        # Node Agent chat
│   ├── (customer)/
│   │   ├── _layout.tsx
│   │   ├── index.tsx           # Discovery + browse
│   │   ├── search.tsx          # Discovery Agent chat
│   │   ├── cart.tsx            # Customer Agent chat
│   │   └── bookings.tsx        # Booking Agent chat
│   └── (admin)/
│       └── dashboard.tsx       # Admin Agent chat
├── components/
│   ├── AgentSelector.tsx       # Agent selection grid
│   ├── AgentChat.tsx           # Conversational UI
│   ├── MessageBubble.tsx       # Chat message
│   ├── QuickActions.tsx        # Bypass chat buttons
│   └── AgentHandoff.tsx        # Switch agent UI
├── hooks/
│   ├── useAgent.ts             # Agent API client
│   ├── useAgentRouter.ts       # Dynamic routing
│   ├── useOfflineSync.ts       # Offline queue
│   └── useInstantDB.ts         # Real-time data
├── services/
│   ├── agent-api.ts            # API client
│   ├── offline-storage.ts      # SQLite wrapper
│   └── sync-manager.ts         # Sync logic
└── types/
    ├── agents.ts               # Agent types
    └── api.ts                  # API types
```

---

## Phase 3.1: Core Infrastructure (Week 1)

### Task 1.1: Project Setup

**Create Expo app:**
```bash
npx create-expo-app@latest tarai-mobile --template tabs
cd tarai-mobile
```

**Install dependencies:**
```bash
# Core
npx expo install expo-router react-native-gesture-handler

# InstantDB
npm install @instantdb/react-native

# Offline storage
npx expo install expo-sqlite

# AI/Agent utilities
npm install @xenova/transformers  # On-device embeddings (optional)

# UI
npm install react-native-paper
npx expo install react-native-safe-area-context
```

**Configure InstantDB:**
```typescript
// config/instantdb.ts
import { init } from '@instantdb/react-native';
import schema from './schema'; // Copy from backend

export const db = init({
  appId: process.env.EXPO_PUBLIC_INSTANTDB_APP_ID,
  schema,
});
```

**Configure API client:**
```typescript
// services/agent-api.ts
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3141';

export class AgentAPI {
  async sendMessage(agentType: string, message: string, context: any) {
    const response = await fetch(`${API_URL}/agents/${agentType}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, ...context }),
    });
    return response.json();
  }
}
```

---

### Task 1.2: Agent Type Definitions

```typescript
// types/agents.ts
export type AgentType =
  | 'discovery'
  | 'product'
  | 'instance'
  | 'order'
  | 'node'
  | 'customer'
  | 'service'
  | 'booking'
  | 'analytics'
  | 'admin';

export interface AgentConfig {
  id: AgentType;
  name: string;
  icon: string;
  description: string;
  scope: 'universal' | 'node' | 'customer' | 'admin';
  color: string;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  agentType: AgentType;
}

export interface AgentContext {
  userId?: string;
  nodeId?: string;
  role?: 'customer' | 'nodeowner' | 'admin';
  conversationId: string;
}
```

---

### Task 1.3: Agent Configurations

```typescript
// config/agents.ts
export const AGENT_CONFIGS: Record<AgentType, AgentConfig> = {
  discovery: {
    id: 'discovery',
    name: 'Discovery',
    icon: '🔍',
    description: 'Search products & stores',
    scope: 'universal',
    color: '#6366f1',
  },
  product: {
    id: 'product',
    name: 'Products',
    icon: '🛍️',
    description: 'Manage products',
    scope: 'node',
    color: '#ec4899',
  },
  instance: {
    id: 'instance',
    name: 'Inventory',
    icon: '📦',
    description: 'Stock & variants',
    scope: 'node',
    color: '#f59e0b',
  },
  order: {
    id: 'order',
    name: 'Orders',
    icon: '📋',
    description: 'View & manage orders',
    scope: 'node',
    color: '#10b981',
  },
  service: {
    id: 'service',
    name: 'Services',
    icon: '💇',
    description: 'Services & slots',
    scope: 'node',
    color: '#8b5cf6',
  },
  booking: {
    id: 'booking',
    name: 'Bookings',
    icon: '📅',
    description: 'Book appointments',
    scope: 'customer',
    color: '#06b6d4',
  },
  node: {
    id: 'node',
    name: 'Settings',
    icon: '⚙️',
    description: 'Store settings',
    scope: 'node',
    color: '#64748b',
  },
  customer: {
    id: 'customer',
    name: 'My Orders',
    icon: '🛒',
    description: 'Order history',
    scope: 'customer',
    color: '#14b8a6',
  },
  analytics: {
    id: 'analytics',
    name: 'Analytics',
    icon: '📊',
    description: 'Business insights',
    scope: 'node',
    color: '#f43f5e',
  },
  admin: {
    id: 'admin',
    name: 'Admin',
    icon: '👑',
    description: 'Platform admin',
    scope: 'admin',
    color: '#a855f7',
  },
};
```

---

## Phase 3.2: Agent Selector UI (Week 1-2)

### Task 2.1: Agent Selector Component

```typescript
// components/AgentSelector.tsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AGENT_CONFIGS } from '../config/agents';

interface Props {
  availableAgents: AgentType[];
  onSelect: (agent: AgentType) => void;
}

export function AgentSelector({ availableAgents, onSelect }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Agent</Text>
      <View style={styles.grid}>
        {availableAgents.map(agentId => {
          const config = AGENT_CONFIGS[agentId];
          return (
            <TouchableOpacity
              key={agentId}
              style={[styles.card, { borderColor: config.color }]}
              onPress={() => onSelect(agentId)}
            >
              <Text style={styles.icon}>{config.icon}</Text>
              <Text style={styles.name}>{config.name}</Text>
              <Text style={styles.desc}>{config.description}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    width: '47%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: '#fff',
  },
  icon: { fontSize: 32, marginBottom: 8 },
  name: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  desc: { fontSize: 12, color: '#666' },
});
```

---

### Task 2.2: Store Owner Dashboard

```typescript
// app/(store-owner)/index.tsx
import { useState } from 'react';
import { AgentSelector } from '@/components/AgentSelector';
import { useRouter } from 'expo-router';

export default function StoreOwnerDashboard() {
  const router = useRouter();
  const nodeId = 'store-node-id'; // From auth context

  const storeOwnerAgents: AgentType[] = [
    'product',
    'instance',
    'order',
    'service',
    'analytics',
    'node',
  ];

  const handleAgentSelect = (agent: AgentType) => {
    router.push(`/(store-owner)/${agent}`);
  };

  return (
    <AgentSelector
      availableAgents={storeOwnerAgents}
      onSelect={handleAgentSelect}
    />
  );
}
```

---

## Phase 3.3: Agent Chat Interface (Week 2-3)

### Task 3.1: Chat Component

```typescript
// components/AgentChat.tsx
import { useState, useEffect, useRef } from 'react';
import {
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
} from 'react-native';
import { MessageBubble } from './MessageBubble';
import { useAgent } from '@/hooks/useAgent';

interface Props {
  agentType: AgentType;
  context: AgentContext;
}

export function AgentChat({ agentType, context }: Props) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState('');
  const { sendMessage, isLoading } = useAgent(agentType, context);
  const flatListRef = useRef(null);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: AgentMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
      agentType,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');

    try {
      const response = await sendMessage(input);

      const botMessage: AgentMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.message,
        timestamp: Date.now(),
        agentType,
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Agent error:', error);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={({ item }) => <MessageBubble message={item} />}
        keyExtractor={item => item.id}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          multiline
        />
        <TouchableOpacity
          style={styles.sendButton}
          onPress={handleSend}
          disabled={isLoading}
        >
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
```

---

### Task 3.2: Message Bubble Component

```typescript
// components/MessageBubble.tsx
import { View, Text, StyleSheet } from 'react-native';
import { AGENT_CONFIGS } from '@/config/agents';

export function MessageBubble({ message }: { message: AgentMessage }) {
  const isUser = message.role === 'user';
  const config = AGENT_CONFIGS[message.agentType];

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.botContainer]}>
      {!isUser && <Text style={styles.agentIcon}>{config.icon}</Text>}
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.botBubble]}>
        <Text style={[styles.text, isUser ? styles.userText : styles.botText]}>
          {message.content}
        </Text>
        <Text style={styles.timestamp}>
          {new Date(message.timestamp).toLocaleTimeString()}
        </Text>
      </View>
    </View>
  );
}
```

---

### Task 3.3: useAgent Hook

```typescript
// hooks/useAgent.ts
import { useState } from 'react';
import { AgentAPI } from '@/services/agent-api';

export function useAgent(agentType: AgentType, context: AgentContext) {
  const [isLoading, setIsLoading] = useState(false);
  const api = new AgentAPI();

  const sendMessage = async (message: string) => {
    setIsLoading(true);
    try {
      const response = await api.sendMessage(agentType, message, context);
      return response;
    } finally {
      setIsLoading(false);
    }
  };

  return { sendMessage, isLoading };
}
```

---

## Phase 3.4: Agent Switching & Handoff (Week 3)

### Task 4.1: Agent Handoff Component

```typescript
// components/AgentHandoff.tsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  currentAgent: AgentType;
  suggestedAgent: AgentType;
  reason: string;
  onAccept: () => void;
  onDecline: () => void;
}

export function AgentHandoff({
  currentAgent,
  suggestedAgent,
  reason,
  onAccept,
  onDecline,
}: Props) {
  const current = AGENT_CONFIGS[currentAgent];
  const suggested = AGENT_CONFIGS[suggestedAgent];

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🔄</Text>
      <Text style={styles.title}>Switch Agent?</Text>
      <Text style={styles.message}>
        {current.name} → {suggested.name}
      </Text>
      <Text style={styles.reason}>{reason}</Text>
      <View style={styles.buttons}>
        <TouchableOpacity style={styles.acceptButton} onPress={onAccept}>
          <Text style={styles.acceptText}>Switch to {suggested.name}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.declineButton} onPress={onDecline}>
          <Text style={styles.declineText}>Stay here</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
```

---

### Task 4.2: Context Preservation

```typescript
// hooks/useAgentRouter.ts
import { useState } from 'react';
import { useRouter } from 'expo-router';

export function useAgentRouter() {
  const router = useRouter();
  const [handoffContext, setHandoffContext] = useState<any>(null);

  const switchAgent = (toAgent: AgentType, context?: any) => {
    setHandoffContext(context);
    router.push(`/(store-owner)/${toAgent}`);
  };

  const getHandoffContext = () => {
    const context = handoffContext;
    setHandoffContext(null); // Clear after use
    return context;
  };

  return { switchAgent, getHandoffContext };
}
```

---

## Phase 3.5: Offline Support (Week 4)

### Task 5.1: Offline Storage Setup

```typescript
// services/offline-storage.ts
import * as SQLite from 'expo-sqlite';

export class OfflineStorage {
  private db: SQLite.SQLiteDatabase;

  async init() {
    this.db = await SQLite.openDatabaseAsync('tarai-offline.db');

    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS pending_operations (
        id TEXT PRIMARY KEY,
        agentType TEXT NOT NULL,
        action TEXT NOT NULL,
        data TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        synced INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS cached_data (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
    `);
  }

  async queueOperation(agentType: string, action: string, data: any) {
    const id = Date.now().toString();
    await this.db.runAsync(
      'INSERT INTO pending_operations VALUES (?, ?, ?, ?, ?, 0)',
      [id, agentType, action, JSON.stringify(data), Date.now()]
    );
  }

  async getPendingOperations() {
    return await this.db.getAllAsync(
      'SELECT * FROM pending_operations WHERE synced = 0'
    );
  }

  async markSynced(id: string) {
    await this.db.runAsync(
      'UPDATE pending_operations SET synced = 1 WHERE id = ?',
      [id]
    );
  }
}
```

---

### Task 5.2: Sync Manager

```typescript
// services/sync-manager.ts
import NetInfo from '@react-native-community/netinfo';
import { OfflineStorage } from './offline-storage';
import { AgentAPI } from './agent-api';

export class SyncManager {
  private storage: OfflineStorage;
  private api: AgentAPI;
  private isSyncing = false;

  constructor() {
    this.storage = new OfflineStorage();
    this.api = new AgentAPI();
    this.listenToNetwork();
  }

  private listenToNetwork() {
    NetInfo.addEventListener(state => {
      if (state.isConnected && !this.isSyncing) {
        this.syncPendingOperations();
      }
    });
  }

  async syncPendingOperations() {
    this.isSyncing = true;
    const pending = await this.storage.getPendingOperations();

    for (const op of pending) {
      try {
        await this.api.sendMessage(
          op.agentType,
          op.action,
          JSON.parse(op.data)
        );
        await this.storage.markSynced(op.id);
      } catch (error) {
        console.error('Sync error:', error);
      }
    }

    this.isSyncing = false;
  }
}
```

---

### Task 5.3: Offline-First Hook

```typescript
// hooks/useOfflineSync.ts
import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { OfflineStorage } from '@/services/offline-storage';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const storage = new OfflineStorage();

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? false);
    });

    return unsubscribe;
  }, []);

  const queueOperation = async (agentType: string, action: string, data: any) => {
    await storage.queueOperation(agentType, action, data);
    const pending = await storage.getPendingOperations();
    setPendingCount(pending.length);
  };

  return { isOnline, pendingCount, queueOperation };
}
```

---

## Phase 3.6: InstantDB Real-time Integration (Week 4-5)

### Task 6.1: InstantDB Hook

```typescript
// hooks/useInstantDB.ts
import { useQuery } from '@instantdb/react-native';
import { db } from '@/config/instantdb';

export function useProducts(nodeId: string) {
  const { data, isLoading, error } = useQuery({
    products: {
      $: { where: { nodeid: nodeId } },
      instances: {},
    },
  });

  return {
    products: data?.products || [],
    isLoading,
    error,
  };
}

export function useOrders(nodeId: string) {
  const { data } = useQuery({
    orders: {
      $: { where: { nodeid: nodeId } },
      contributor: {},
      lineitems: {},
    },
  });

  return { orders: data?.orders || [] };
}
```

---

### Task 6.2: Hybrid Data Strategy

```typescript
// Use InstantDB for reads (free, real-time)
const { products } = useProducts(nodeId);

// Use Agent API for writes (validated, conversational)
const { sendMessage } = useAgent('product', context);
await sendMessage('Create cotton t-shirt, price 499');
```

---

## Phase 3.7: Quick Actions (Bypass Chat) (Week 5)

### Task 7.1: Quick Actions Component

```typescript
// components/QuickActions.tsx
import { View, TouchableOpacity, Text } from 'react-native';

interface Props {
  agentType: AgentType;
  onAction: (action: string) => void;
}

const QUICK_ACTIONS: Record<AgentType, string[]> = {
  product: ['Create Product', 'View Products', 'Search Products'],
  instance: ['Add Variants', 'Check Stock', 'Update Inventory'],
  order: ['Today\'s Orders', 'Pending Orders', 'Delivered Orders'],
  service: ['Create Service', 'View Slots', 'Add Time Slots'],
  analytics: ['Today Sales', 'This Week', 'This Month'],
};

export function QuickActions({ agentType, onAction }: Props) {
  const actions = QUICK_ACTIONS[agentType] || [];

  return (
    <View style={styles.container}>
      {actions.map(action => (
        <TouchableOpacity
          key={action}
          style={styles.button}
          onPress={() => onAction(action)}
        >
          <Text>{action}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
```

---

## Phase 3.8: Testing (Week 5-6)

### Task 8.1: Unit Tests

```typescript
// __tests__/useAgent.test.ts
import { renderHook, waitFor } from '@testing-library/react-native';
import { useAgent } from '@/hooks/useAgent';

describe('useAgent', () => {
  it('should send message and return response', async () => {
    const { result } = renderHook(() =>
      useAgent('product', { nodeId: 'test' })
    );

    const response = await result.current.sendMessage('Create product');

    expect(response.success).toBe(true);
    expect(response.message).toBeDefined();
  });
});
```

---

### Task 8.2: Integration Tests

```typescript
// __tests__/AgentChat.test.tsx
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { AgentChat } from '@/components/AgentChat';

describe('AgentChat', () => {
  it('should send and receive messages', async () => {
    const { getByPlaceholderText, getByText } = render(
      <AgentChat agentType="product" context={{ nodeId: 'test' }} />
    );

    const input = getByPlaceholderText('Type a message...');
    fireEvent.changeText(input, 'Create t-shirt');

    const sendButton = getByText('Send');
    fireEvent.press(sendButton);

    await waitFor(() => {
      expect(getByText(/Product created/)).toBeTruthy();
    });
  });
});
```

---

## Phase 3.9: Performance Optimization (Week 6)

### Task 9.1: Message Virtualization

```typescript
// Use react-native-flash-list for better performance
import { FlashList } from '@shopify/flash-list';

<FlashList
  data={messages}
  renderItem={({ item }) => <MessageBubble message={item} />}
  estimatedItemSize={80}
/>
```

---

### Task 9.2: Image Caching

```typescript
// expo-image for better caching
import { Image } from 'expo-image';

<Image
  source={{ uri: product.image }}
  placeholder={blurhash}
  contentFit="cover"
  cachePolicy="memory-disk"
/>
```

---

## Deliverables

### Week 1
- ✅ Expo app scaffolding
- ✅ InstantDB integration
- ✅ Agent configurations
- ✅ API client setup

### Week 2
- ✅ Agent selector UI
- ✅ Store owner dashboard
- ✅ Customer dashboard
- ✅ Basic chat interface

### Week 3
- ✅ Full chat functionality
- ✅ Agent switching
- ✅ Context handoff
- ✅ Message bubbles

### Week 4
- ✅ Offline storage
- ✅ Sync manager
- ✅ InstantDB real-time
- ✅ Hybrid data strategy

### Week 5
- ✅ Quick actions
- ✅ Voice input (optional)
- ✅ Unit tests
- ✅ Integration tests

### Week 6
- ✅ Performance optimization
- ✅ Error handling
- ✅ Loading states
- ✅ Polish & refinements

---

## Success Metrics

**User Experience:**
- Agent switch time: <500ms
- Message send/receive: <2s
- Offline queue: 100% reliable
- App launch: <3s

**Technical:**
- Test coverage: >80%
- Crash-free rate: >99%
- Offline-first: 100% node ops
- Real-time sync: <1s latency

---

## Environment Setup

```bash
# .env
EXPO_PUBLIC_INSTANTDB_APP_ID=your-app-id
EXPO_PUBLIC_API_URL=http://localhost:3141
EXPO_PUBLIC_GROQ_API_KEY=your-key (if on-device AI)
```

---

## Deployment

### EAS Build

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure
eas build:configure

# Build for Android
eas build --platform android

# Build for iOS
eas build --platform ios

# Submit to stores
eas submit
```

---

## Next Steps After Phase 3

**Phase 4: Advanced Features**
- Voice input per agent
- Image recognition for products
- AR product preview
- Multi-language support

**Phase 5: Scale**
- Push notifications
- Background sync
- Analytics dashboard
- A/B testing

---

## Notes

- Keep agent logic on backend (CF Workers)
- Use InstantDB for reads (free, fast)
- Use agents for writes (validated, safe)
- Offline-first for store owners
- Online-first for customers
- Test on real devices early

---

**Phase 3 Timeline: 6 weeks**
**Start when ready. All backend agents are operational.**
