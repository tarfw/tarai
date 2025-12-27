import { BskyAgent } from "@atproto/api";

export interface BlueskyConversation {
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

/**
 * Get list of user's conversations
 * Note: Bluesky DMs are in beta and use chat.bsky.com service
 */
export async function getConversations(agent: BskyAgent): Promise<BlueskyConversation[]> {
  try {
    // Try to fetch conversations from the chat service
    // This uses the getConvoList endpoint from chat.bsky.com
    const response = await agent.api.chat.bsky.convo.listConvos();

    if (!response.success || !response.data.convos) {
      return [];
    }

    return response.data.convos.map((convo: any) => ({
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
    const response = await agent.api.chat.bsky.convo.getMessages({
      convoId: conversationId,
      limit,
    });

    if (!response.success || !response.data.messages) {
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
 * Send a message to a user
 */
export async function sendMessage(
  agent: BskyAgent,
  recipientDid: string,
  text: string
): Promise<boolean> {
  try {
    // First, get or create conversation with the recipient
    const convosResponse = await agent.api.chat.bsky.convo.listConvos();

    let conversationId: string | null = null;

    if (convosResponse.success && convosResponse.data.convos) {
      const existingConvo = convosResponse.data.convos.find(
        (convo: any) => convo.members?.some((m: any) => m.did === recipientDid)
      );
      if (existingConvo) {
        conversationId = existingConvo.id;
      }
    }

    // Send the message
    const sendResponse = await agent.api.chat.bsky.convo.sendMessage({
      convoId: conversationId || "",
      message: {
        text,
      },
    });

    return sendResponse.success;
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
