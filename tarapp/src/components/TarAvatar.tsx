import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

export type TarAvatarExpression = 'dots' | 'happy' | 'bee';

export interface TarAvatarProps {
  size?: number;
  bgColor?: string;
  eyeColor?: string;
  expression?: TarAvatarExpression;
  style?: StyleProp<ViewStyle>;
}

/**
 * Minimal Codex/Grok style Squircle Bot Avatar for TAR & Ask TAR.
 * Soft pastel circle, two proper round eyes, and a big triangle speaking
 * mouth pinned to the right edge so the mascot reads as talking.
 */
export function TarAvatar({
  size = 24,
  bgColor = '#D8B4FE', // Soft lilac/lavender from user reference
  eyeColor = '#111827', // Deep charcoal/black
  expression = 'happy',
  style,
}: TarAvatarProps) {
  const circleRadius = size / 2;
  const eyeSize = Math.max(3, Math.round(size * 0.24));
  const eyeRadius = eyeSize / 2;
  // one eye on the right, so the mascot reads as facing right
  const eyeRight = Math.round(size * 0.22);
  const eyeTop = Math.round(size * 0.2);

  // Big triangle mouth, mirrored to point left, flush with the right edge
  const mouthW = Math.max(6, Math.round(size * 0.34));
  const mouthH = Math.max(8, Math.round(size * 0.42));

  // Antennae nubs for 'bee'
  const antW = Math.max(1.5, Math.round(size * 0.08));
  const antH = Math.max(2.5, Math.round(size * 0.16));

  return (
    <View
      style={[
        styles.squircle,
        {
          width: size,
          height: size,
          borderRadius: circleRadius,
          backgroundColor: bgColor,
        },
        style,
      ]}
    >
      {/* Optional Bee Antennae Nubs */}
      {expression === 'bee' ? (
        <View style={styles.antennaRow}>
          <View
            style={[
              styles.antenna,
              {
                width: antW,
                height: antH,
                borderRadius: antW / 2,
                backgroundColor: eyeColor,
                transform: [{ rotate: '-15deg' }],
              },
            ]}
          />
          <View
            style={[
              styles.antenna,
              {
                width: antW,
                height: antH,
                borderRadius: antW / 2,
                backgroundColor: eyeColor,
                transform: [{ rotate: '15deg' }],
              },
            ]}
          />
        </View>
      ) : null}

      {/* One round eye, held to the right side */}
      <View
        style={[
          styles.eye,
          {
            width: eyeSize,
            height: eyeSize,
            borderRadius: eyeRadius,
            backgroundColor: eyeColor,
            right: eyeRight,
            top: eyeTop,
          },
        ]}
      />

      {/* Speaking mouth: big triangle pointing left, right edge flush */}
      <View
        style={[
          styles.mouth,
          {
            width: 0,
            height: 0,
            borderTopWidth: mouthH / 2,
            borderTopColor: 'transparent',
            borderBottomWidth: mouthH / 2,
            borderBottomColor: 'transparent',
            borderRightWidth: mouthW,
            borderRightColor: eyeColor,
            right: 0,
            bottom: Math.round(size * 0.14),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  squircle: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  antennaRow: {
    position: 'absolute',
    top: '12%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '44%',
  },
  antenna: {},
  eye: {
    position: 'absolute',
  },
  mouth: {
    position: 'absolute',
  },
});

export default TarAvatar;
