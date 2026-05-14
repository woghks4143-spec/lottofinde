/**
 * Pretendard font asset map for expo-font's useFonts().
 *
 * RN doesn't pick up font weights automatically on Android (and is iffy on iOS
 * for OTF), so we register each weight as its own family and reference it by
 * exact name in typography styles.
 */
export const FONT_ASSETS = {
  'Pretendard-Regular': require('@/assets/fonts/Pretendard-Regular.otf'),
  'Pretendard-Medium': require('@/assets/fonts/Pretendard-Medium.otf'),
  'Pretendard-SemiBold': require('@/assets/fonts/Pretendard-SemiBold.otf'),
  'Pretendard-Bold': require('@/assets/fonts/Pretendard-Bold.otf'),
  'Pretendard-ExtraBold': require('@/assets/fonts/Pretendard-ExtraBold.otf'),
};

export const FONT_FAMILY = {
  regular: 'Pretendard-Regular',
  medium: 'Pretendard-Medium',
  semibold: 'Pretendard-SemiBold',
  bold: 'Pretendard-Bold',
  extrabold: 'Pretendard-ExtraBold',
} as const;
