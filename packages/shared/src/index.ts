export type PresenceStatus = 'online' | 'offline';
export type ConversationType = 'private' | 'group';
export type ReceiptStatus = 'sent' | 'delivered' | 'read';

export interface SafeUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  status: PresenceStatus;
}

export interface MessagePayload {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

export interface SendMessageInput {
  conversationId: string;
  content: string;
  clientMessageId: string;
}
