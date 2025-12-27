import { BskyAgent } from "@atproto/api";

export interface BlueskyConversation {
  id: string;  // Conversation ID - unique identifier
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  lastMessage?: string;
  lastMessageTime?: number;
  unreadCount?: number;
}

export interface BlueskyMessage {
  id: string;
  text: string;
  sender: string;
  timestamp: number;
  uri?: string;
}

// The magic header that enables DM access
const CHAT_PROXY_HEADERS = {
  'atproto-proxy': 'did:web:api.bsky.chat#bsky_chat'
};

/**
 * Get list of user's conversations
 * Note: Requires the atproto-proxy header to access the chat service
 */
export async function getConversations(agent: BskyAgent): Promise<BlueskyConversation[]> {
  try {
    // Check if agent has a session
    if (!agent.session) {
      throw new Error("Not authenticated - session missing");
    }

    // Use the agent API with the chat proxy header
    const response = await agent.api.chat.bsky.convo.listConvos(
      { limit: 20 },
      { headers: CHAT_PROXY_HEADERS }
    );

    if (!response.data?.convos) {
      return [];
    }

    return response.data.convos.map((convo: any) => ({
      id: convo.id,  // Add conversation ID
      did: convo.members?.[0]?.did || "",
      handle: convo.members?.[0]?.handle || "",
      displayName: convo.members?.[0]?.displayName,
      avatar: convo.members?.[0]?.avatar,
      lastMessage: convo.lastMessage?.text,
      lastMessageTime: convo.lastMessage?.sentAt ? new Date(convo.lastMessage.sentAt).getTime() : undefined,
      unreadCount: convo.unreadCount,
    }));
  } catch (e) {
    console.error("Failed to fetch conversations", e);
    return [];
  }
}

/**
 * Get messages from a specific conversation
 */
export async function getMessages(
  agent: BskyAgent,
  conversationId: string,
  limit: number = 50
): Promise<BlueskyMessage[]> {
  try {
    const response = await agent.api.chat.bsky.convo.getMessages(
      {
        convoId: conversationId,
        limit,
      },
      { headers: CHAT_PROXY_HEADERS }
    );

    if (!response.data?.messages) {
      return [];
    }

    return response.data.messages.map((msg: any) => ({
      id: msg.id,
      text: msg.text,
      sender: msg.sender?.did || "",
      timestamp: new Date(msg.sentAt).getTime(),
      uri: msg.id,
    })).reverse(); // Reverse to show oldest first
  } catch (e) {
    console.error("Failed to fetch messages", e);
    return [];
  }
}

/**
 * Send a message to a user (or conversation)
 */
export async function sendMessage(
  agent: BskyAgent,
  conversationIdOrRecipientDid: string,
  text: string
): Promise<boolean> {
  try {
    let conversationId = conversationIdOrRecipientDid;

    // If it looks like a DID (starts with 'did:'), get or create conversation first
    if (conversationIdOrRecipientDid.startsWith('did:')) {
      const convosResponse = await agent.api.chat.bsky.convo.listConvos(
        {},
        { headers: CHAT_PROXY_HEADERS }
      );

      const existingConvo = convosResponse.data.convos?.find(
        (convo: any) => convo.members?.some((m: any) => m.did === conversationIdOrRecipientDid)
      );

      if (existingConvo) {
        conversationId = existingConvo.id;
      } else {
        // Need to create a conversation first
        const newConvoResponse = await agent.api.chat.bsky.convo.getConvoForMembers(
          { members: [conversationIdOrRecipientDid] },
          { headers: CHAT_PROXY_HEADERS }
        );
        conversationId = newConvoResponse.data.convo.id;
      }
    }

    // Send the message with chat proxy header
    const sendResponse = await agent.api.chat.bsky.convo.sendMessage(
      {
        convoId: conversationId,
        message: {
          text,
        },
      },
      { headers: CHAT_PROXY_HEADERS }
    );

    return true;
  } catch (e) {
    console.error("Failed to send message", e);
    return false;
  }
}

/**
 * Initiate a conversation with a user
 */
export async function startConversation(
  agent: BskyAgent,
  recipientDid: string
): Promise<string | null> {
  try {
    // Send initial empty message or check if convo exists
    const response = await agent.api.chat.bsky.convo.listConvos();

    if (response.success && response.data.convos) {
      const existingConvo = response.data.convos.find(
        (convo: any) => convo.members?.some((m: any) => m.did === recipientDid)
      );
      if (existingConvo) {
        return existingConvo.id;
      }
    }

    // If no existing conversation, we need to send the first message
    // to create the conversation
    return null; // Caller should send first message to create convo
  } catch (e) {
    console.error("Failed to start conversation", e);
    return null;
  }
}

/**
 * Get user profile by DID or handle
 */
export async function getUserProfile(
  agent: BskyAgent,
  identifier: string
): Promise<BlueskyConversation | null> {
  try {
    const response = await agent.getProfile({ actor: identifier });

    if (!response.success) {
      return null;
    }

    const profile = response.data;

    return {
      did: profile.did,
      handle: profile.handle,
      displayName: profile.displayName,
      avatar: profile.avatar,
    };
  } catch (e) {
    console.error("Failed to fetch user profile", e);
    return null;
  }
}

/**
 * Search for users by handle or display name
 */
export async function searchUsers(
  agent: BskyAgent,
  query: string,
  limit: number = 20
): Promise<BlueskyConversation[]> {
  try {
    const response = await agent.searchActors({
      q: query,
      limit,
    });

    if (!response.success || !response.data.actors) {
      return [];
    }

    return response.data.actors.map((actor: any) => ({
      did: actor.did,
      handle: actor.handle,
      displayName: actor.displayName,
      avatar: actor.avatar,
    }));
  } catch (e) {
    console.error("Failed to search users", e);
    return [];
  }
}

/**
 * Setup real-time polling for messages in a conversation
 * Polls the server at regular intervals for new messages
 */
export function setupMessagePolling(
  agent: BskyAgent,
  conversationId: string,
  onMessagesUpdate: (messages: BlueskyMessage[]) => void,
  pollInterval: number = 1000 // Poll every 1 second
): () => void {
  let isActive = true;
  let lastTimestamp = Date.now();

  const poll = async () => {
    if (!isActive) return;

    try {
      const messages = await getMessages(agent, conversationId, 50);
      if (isActive) {
        onMessagesUpdate(messages);
      }
    } catch (e) {
      console.error("Message polling failed", e);
    }

    if (isActive) {
      setTimeout(poll, pollInterval);
    }
  };

  // Start polling
  poll();

  // Return cleanup function to stop polling
  return () => {
    isActive = false;
  };
}

/**
 * Setup real-time polling for conversations
 * Polls the server at regular intervals for updated conversation list
 */
export function setupConversationPolling(
  agent: BskyAgent,
  onConversationsUpdate: (conversations: BlueskyConversation[]) => void,
  pollInterval: number = 2000 // Poll every 2 seconds
): () => void {
  let isActive = true;

  const poll = async () => {
    if (!isActive) return;

    try {
      const conversations = await getConversations(agent);
      if (isActive) {
        onConversationsUpdate(conversations);
      }
    } catch (e) {
      console.error("Conversation polling failed", e);
    }

    if (isActive) {
      setTimeout(poll, pollInterval);
    }
  };

  // Start polling
  poll();

  // Return cleanup function to stop polling
  return () => {
    isActive = false;
  };
}
