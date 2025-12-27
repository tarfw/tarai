import { useState, useCallback, useRef } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useBlueskyAuth } from '@/contexts/BlueskyAuthContext';
import { getMessages, sendMessage, setupMessagePolling } from '@/services/blueskyService';
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
  const stopPollingRef = useRef<(() => void) | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (agent && convoId) {
        loadMessagesAndStartPolling();
      }
      return () => {
        if (stopPollingRef.current) {
          stopPollingRef.current();
          stopPollingRef.current = null;
        }
      };
    }, [agent, convoId])
  );

  const loadMessagesAndStartPolling = async () => {
    if (!agent || !convoId) return;
    try {
      setIsLoading(true);
      const msgs = await getMessages(agent, convoId, 50);
      setMessages(msgs);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    } catch (e) {
      console.error('Failed to load messages', e);
    } finally {
      setIsLoading(false);
    }

    if (stopPollingRef.current) {
      stopPollingRef.current();
    }
    stopPollingRef.current = setupMessagePolling(
      agent,
      convoId,
      (updatedMessages) => {
        setMessages(updatedMessages);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      },
      1000
    );
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !agent || !convoId || isSending) return;

    const textToSend = messageText.trim();
    setMessageText('');

    try {
      setIsSending(true);
      const success = await sendMessage(agent, convoId, textToSend);

      if (success) {
        const newMessage: BlueskyMessage = {
          id: Date.now().toString(),
          text: textToSend,
          sender: currentDid || '',
          timestamp: Date.now(),
        };
        setMessages([...messages, newMessage]);
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

  const styles = createStyles(colors, spacing, radius, typography, insets);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <FontAwesome6 name="chevron-left" size={20} color={colors.accent} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>{handle || 'User'}</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>{`@${handle || 'user'}`}</Text>
          </View>
        </View>

        {/* Messages List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Loading messages...</Text>
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
            keyExtractor={(item, index) => item.id || `message-${index}`}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                isOwn={item.sender === currentDid}
                colors={colors}
                spacing={spacing}
                radius={radius}
                typography={typography}
              />
            )}
            contentContainerStyle={styles.messagesList}
            scrollEnabled={true}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        )}
      </SafeAreaView>

      {/* Input Area with KeyboardAvoidingView */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
        style={styles.keyboardAvoidingView}
      >
        <View style={[styles.inputWrapper, { paddingBottom: Math.max(insets.bottom, 8) + 12 }]}>
          <View style={styles.inputContainer}>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.input}
                placeholder="Message..."
                placeholderTextColor={colors.textTertiary}
                value={messageText}
                onChangeText={setMessageText}
                multiline
                maxLength={280}
                editable={!isSending}
                returnKeyType="default"
              />
            </View>
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!messageText.trim() || isSending) && styles.sendButtonDisabled,
              ]}
              onPress={handleSendMessage}
              disabled={!messageText.trim() || isSending}
              activeOpacity={0.7}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <FontAwesome6 name="paper-plane" size={18} color="#FFFFFF" solid />
              )}
            </TouchableOpacity>
          </View>
          {messageText.length > 0 && (
            <Text style={styles.charCount}>
              {`${messageText.length}/280`}
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
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
    <View style={[staticStyles.messageBubbleRow, isOwn && staticStyles.messageBubbleRowOwn]}>
      <View
        style={[
          staticStyles.messageBubble,
          isOwn ? staticStyles.messageBubbleOwn : staticStyles.messageBubbleReceived,
          {
            backgroundColor: isOwn ? colors.accent : colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <Text style={[staticStyles.messageText, { color: isOwn ? '#FFFFFF' : colors.textPrimary }]}>
          {message.text || ''}
        </Text>
        <Text style={[staticStyles.messageTime, { color: isOwn ? 'rgba(255,255,255,0.8)' : colors.textTertiary }]}>
          {timeString}
        </Text>
      </View>
    </View>
  );
}

const staticStyles = StyleSheet.create({
  messageBubbleRow: {
    paddingHorizontal: 16,
    paddingVertical: 3,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  messageBubbleRowOwn: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  messageBubbleOwn: {
    borderBottomRightRadius: 4,
  },
  messageBubbleReceived: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '400',
  },
});

const createStyles = (colors: any, spacing: any, radius: any, typography: any, insets: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    safeArea: {
      flex: 1,
    },
    keyboardAvoidingView: {
      position: 'relative',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
      gap: 12,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerInfo: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    headerSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
    },
    loadingText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    emptyIconWrapper: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    messagesList: {
      paddingVertical: 12,
      flexGrow: 1,
      justifyContent: 'flex-end',
    },
    inputWrapper: {
      backgroundColor: colors.background,
      paddingHorizontal: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 10,
    },
    inputBox: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 24,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 44,
      maxHeight: 120,
      justifyContent: 'center',
    },
    input: {
      fontSize: 15,
      color: colors.textPrimary,
      lineHeight: 20,
      paddingVertical: 0,
      textAlignVertical: 'center',
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 3,
    },
    sendButtonDisabled: {
      opacity: 0.4,
      shadowOpacity: 0,
      elevation: 0,
    },
    charCount: {
      fontSize: 12,
      color: colors.textTertiary,
      textAlign: 'right',
      marginTop: 6,
      paddingRight: 4,
    },
  });
