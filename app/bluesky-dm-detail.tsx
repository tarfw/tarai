import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useBlueskyAuth } from '@/contexts/BlueskyAuthContext';
import { getMessages, sendMessage } from '@/services/blueskyService';
import type { BlueskyMessage } from '@/services/blueskyService';

export default function DMDetailScreen() {
  const insets = useSafeAreaInsets();
  const { colors, spacing, radius, typography } = useTheme();
  const { agent, handle: currentHandle } = useBlueskyAuth();
  const { did, handle } = useLocalSearchParams<{ did: string; handle: string }>();

  const [messages, setMessages] = useState<BlueskyMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useFocusEffect(
    useCallback(() => {
      if (agent && did) {
        loadMessages();
      }
    }, [agent, did])
  );

  const loadMessages = async () => {
    if (!agent || !did) return;
    try {
      setIsLoading(true);
      const msgs = await getMessages(agent, did, 50);
      setMessages(msgs);
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (e) {
      console.error('Failed to load messages', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !agent || !did || isSending) return;

    const textToSend = messageText.trim();
    setMessageText('');

    try {
      setIsSending(true);
      const success = await sendMessage(agent, did, textToSend);

      if (success) {
        // Add message optimistically
        const newMessage: BlueskyMessage = {
          id: Date.now().toString(),
          text: textToSend,
          sender: currentHandle || '',
          timestamp: Date.now(),
        };
        setMessages([...messages, newMessage]);
        flatListRef.current?.scrollToEnd({ animated: true });
      } else {
        setMessageText(textToSend);
      }
    } catch (e) {
      console.error('Failed to send message', e);
      setMessageText(textToSend);
    } finally {
      setIsSending(false);
    }
  };

  const styles = createStyles(colors, spacing, radius, typography);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={80}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome6 name="chevron-left" size={20} color={colors.accent} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{handle}</Text>
          <Text style={styles.headerSubtitle}>@{handle}</Text>
        </View>
      </View>

      {/* Messages List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.emptyTitle, { marginTop: spacing.md }]}>Loading messages...</Text>
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.emptyMessagesContainer}>
          <FontAwesome6 name="message" size={40} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptySubtitle}>Start the conversation by sending a message</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View>
              <MessageBubble
                message={item}
                isOwn={item.sender === currentHandle}
                colors={colors}
                spacing={spacing}
                radius={radius}
                typography={typography}
              />
            </View>
          )}
          contentContainerStyle={styles.messagesList}
          scrollEnabled={true}
          onEndReachedThreshold={0.1}
        />
      )}

      {/* Message Input */}
      <View style={[styles.inputArea, { paddingBottom: insets.bottom + spacing.sm }]}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            value={messageText}
            onChangeText={setMessageText}
            placeholderTextColor={colors.textTertiary}
            multiline
            maxLength={280}
            editable={!isSending}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!messageText.trim() || isSending) && styles.sendButtonDisabled,
            ]}
            onPress={handleSendMessage}
            disabled={!messageText.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <FontAwesome6 name="paper-plane" size={18} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
        <Text style={styles.charCount}>{messageText.length}/280</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

interface MessageBubbleProps {
  message: BlueskyMessage;
  isOwn: boolean;
  colors: any;
  spacing: any;
  radius: any;
  typography: any;
}

function MessageBubble({
  message,
  isOwn,
  colors,
  spacing,
  radius,
  typography,
}: MessageBubbleProps) {
  const timeString = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const localStyles = createMessageBubbleStyles(colors, spacing, radius, typography);

  return (
    <View style={[localStyles.messageBubbleContainer, isOwn && localStyles.messageBubbleContainerOwn]}>
      <View
        style={[
          localStyles.messageBubble,
          isOwn && localStyles.messageBubbleOwn,
          { backgroundColor: isOwn ? colors.accent : colors.surface },
        ]}
      >
        <Text style={[localStyles.messageText, isOwn && localStyles.messageTextOwn]}>
          {message.text}
        </Text>
        <Text style={[localStyles.messageTime, isOwn && localStyles.messageTimeOwn]}>
          {timeString}
        </Text>
      </View>
    </View>
  );
}

const createMessageBubbleStyles = (colors: any, spacing: any, radius: any, typography: any) =>
  StyleSheet.create({
    messageBubbleContainer: {
      marginBottom: spacing.sm,
      alignItems: 'flex-start',
    },
    messageBubbleContainerOwn: {
      alignItems: 'flex-end',
    },
    messageBubble: {
      maxWidth: '80%',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.lg,
    },
    messageBubbleOwn: {
      backgroundColor: colors.accent,
    },
    messageText: {
      ...typography.body,
      color: colors.textPrimary,
    },
    messageTextOwn: {
      color: '#FFFFFF',
    },
    messageTime: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    messageTimeOwn: {
      color: 'rgba(255, 255, 255, 0.7)',
    },
  });

const createStyles = (colors: any, spacing: any, radius: any, typography: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.md,
    },
    backButton: {
      padding: spacing.sm,
    },
    headerContent: {
      flex: 1,
    },
    headerTitle: {
      ...typography.headline,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    headerSubtitle: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyMessagesContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
    },
    emptyTitle: {
      ...typography.headline,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    emptySubtitle: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    messagesList: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      flexGrow: 1,
      justifyContent: 'flex-end',
    },
    messageBubbleContainer: {
      marginBottom: spacing.sm,
      alignItems: 'flex-start',
    },
    messageBubbleContainerOwn: {
      alignItems: 'flex-end',
    },
    messageBubble: {
      maxWidth: '80%',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.lg,
    },
    messageBubbleOwn: {
      backgroundColor: colors.accent,
    },
    messageText: {
      ...typography.body,
      color: colors.textPrimary,
    },
    messageTextOwn: {
      color: '#FFFFFF',
    },
    messageTime: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    messageTimeOwn: {
      color: 'rgba(255, 255, 255, 0.7)',
    },
    inputArea: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
    },
    input: {
      flex: 1,
      ...typography.body,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      maxHeight: 100,
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendButtonDisabled: {
      opacity: 0.5,
    },
    charCount: {
      ...typography.caption,
      color: colors.textTertiary,
      marginTop: spacing.xs,
      textAlign: 'right',
    },
  });
