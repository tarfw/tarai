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
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useBlueskyAuth } from '@/contexts/BlueskyAuthContext';
import { getMessages, sendMessage } from '@/services/blueskyService';
import type { BlueskyMessage } from '@/services/blueskyService';

export default function DMDetailScreen() {
  const insets = useSafeAreaInsets();
  const { colors, spacing, radius, typography } = useTheme();
  const { agent, did: currentDid } = useBlueskyAuth();
  const { convoId, did, handle } = useLocalSearchParams<{ convoId: string; did: string; handle: string }>();

  const [messages, setMessages] = useState<BlueskyMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useFocusEffect(
    useCallback(() => {
      if (agent && convoId) {
        loadMessages();
      }
    }, [agent, convoId])
  );

  const loadMessages = async () => {
    if (!agent || !convoId) return;
    try {
      setIsLoading(true);
      const msgs = await getMessages(agent, convoId, 50);
      setMessages(msgs);
      // Auto scroll to bottom after loading
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    } catch (e) {
      console.error('Failed to load messages', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !agent || !convoId || isSending) return;

    const textToSend = messageText.trim();
    setMessageText('');

    try {
      setIsSending(true);
      const success = await sendMessage(agent, convoId, textToSend);

      if (success) {
        // Add message optimistically
        const newMessage: BlueskyMessage = {
          id: Date.now().toString(),
          text: textToSend,
          sender: currentDid || '',
          timestamp: Date.now(),
        };
        setMessages([...messages, newMessage]);
        // Auto scroll to bottom after sending
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 50);
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
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome6 name="chevron-left" size={24} color={colors.accent} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{handle}</Text>
          <Text style={styles.headerSubtitle}>@{handle}</Text>
        </View>
      </View>

      {/* Messages List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrapper}>
            <FontAwesome6 name="comments" size={48} color={colors.textTertiary} />
          </View>
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
                isOwn={item.sender === currentDid}
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

      {/* Floating Input Area */}
      <View style={[styles.inputWrapper, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Message..."
            placeholderTextColor={colors.textTertiary}
            value={messageText}
            onChangeText={setMessageText}
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
              <FontAwesome6 name="paper-plane" size={16} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
        {messageText.length > 0 && (
          <Text style={styles.charCount}>{messageText.length}/280</Text>
        )}
      </View>
    </SafeAreaView>
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

  return (
    <View style={[styles.messageBubbleRow, isOwn && styles.messageBubbleRowOwn]}>
      <View
        style={[
          styles.messageBubble,
          isOwn && styles.messageBubbleOwn,
          {
            backgroundColor: isOwn ? colors.accent : colors.surface,
          },
        ]}
      >
        <Text style={[styles.messageText, isOwn && styles.messageTextOwn]}>
          {message.text}
        </Text>
        <Text style={[styles.messageTime, isOwn && styles.messageTimeOwn]}>
          {timeString}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  messageBubbleRow: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  messageBubbleRowOwn: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  messageBubbleOwn: {},
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTextOwn: {
    color: '#FFFFFF',
  },
  messageTime: {
    fontSize: 12,
    marginTop: 4,
    opacity: 0.7,
  },
  messageTimeOwn: {
    color: '#FFFFFF',
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
      backgroundColor: colors.background,
      gap: spacing.md,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerInfo: {
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
      marginTop: 2,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
    },
    emptyIconWrapper: {
      width: 80,
      height: 80,
      borderRadius: radius.xl,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    emptyTitle: {
      ...typography.headline,
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    emptySubtitle: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    messagesList: {
      paddingVertical: spacing.md,
      flexGrow: 1,
      justifyContent: 'flex-end',
    },
    inputWrapper: {
      backgroundColor: colors.background,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    input: {
      flex: 1,
      ...typography.body,
      color: colors.textPrimary,
      maxHeight: 100,
      minHeight: 40,
    },
    sendButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
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
      textAlign: 'right',
      marginTop: spacing.xs,
    },
  });
