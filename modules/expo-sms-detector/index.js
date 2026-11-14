import { EventEmitter, Subscription } from 'expo-modules-core';
import { Platform } from 'react-native';

let ExpoSmsDetector = null;
let eventEmitter = null;

try {
  const { requireNativeModule } = require('expo-modules-core');
  ExpoSmsDetector = requireNativeModule('ExpoSmsDetector');
  if (ExpoSmsDetector) {
    eventEmitter = new EventEmitter(ExpoSmsDetector);
  }
} catch (e) {
  // Graceful fallback when running in Expo Go or non-Android environment
  console.log('[expo-sms-detector] Native module not found (running in Expo Go or unsupported environment)');
}

/**
 * Check if the SMS detector native module is available
 * @returns {boolean}
 */
export function isSmsDetectorAvailable() {
  if (Platform.OS !== 'android') return false;
  return !!ExpoSmsDetector;
}

/**
 * Start listening for incoming SMS
 */
export function startSmsListener() {
  if (ExpoSmsDetector && ExpoSmsDetector.startListening) {
    ExpoSmsDetector.startListening();
  }
}

/**
 * Stop listening for incoming SMS
 */
export function stopSmsListener() {
  if (ExpoSmsDetector && ExpoSmsDetector.stopListening) {
    ExpoSmsDetector.stopListening();
  }
}

/**
 * Subscribe to incoming SMS events
 * @param {(event: { sender: string, body: string, timestamp: number }) => void} listener
 * @returns {{ remove: () => void }}
 */
export function addSmsListener(listener) {
  if (eventEmitter) {
    return eventEmitter.addListener('onSmsReceived', listener);
  }
  return { remove: () => {} };
}

export default {
  isSmsDetectorAvailable,
  startSmsListener,
  stopSmsListener,
  addSmsListener,
};

