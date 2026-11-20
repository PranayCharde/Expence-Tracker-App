import React, { useState } from 'react';
import { 
  Modal, 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator, 
  Image,
  Alert 
} from 'react-native';
import { 
  X, 
  Camera, 
  Sparkles, 
  CheckCircle2, 
  Image as ImageIcon, 
  Receipt, 
  Calendar, 
  Tag, 
  CreditCard,
  RotateCcw,
  AlertCircle
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { colors } from '../../theme/colors';
import { scanReceiptImage } from '../../services/receiptScannerService';
import { notifyTransaction } from '../../services/notificationService';
import { uploadReceiptToCloudinary } from '../../services/cloudinaryService';

export default function AutoLogReceiptModal({ visible, onClose, onTransactionLogged }) {
  const { user } = useAuth();
  const { isDarkMode, formatCurrency } = useSettings();

  // 'prompt' | 'scanning' | 'saving' | 'success' | 'error'
  const [step, setStep] = useState('prompt');
  const [pickedImageUri, setPickedImageUri] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [loggedData, setLoggedData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const resetState = () => {
    setStep('prompt');
    setPickedImageUri(null);
    setStatusMessage('');
    setLoggedData(null);
    setErrorMessage('');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const processAndAutoLog = async (asset) => {
    if (!asset || !asset.base64) {
      Alert.alert('Error', 'Could not read image data.');
      return;
    }

    setPickedImageUri(asset.uri);
    setStep('scanning');
    setStatusMessage('Reading receipt with AI...');

    try {
      const scanRes = await scanReceiptImage(asset.base64);

      if (!scanRes.success || !scanRes.data || !scanRes.data.amount) {
        throw new Error(scanRes.error || 'Could not detect bill amount clearly. Please ensure the total amount is visible.');
      }

      const d = scanRes.data;
      setStep('saving');
      setStatusMessage('Auto-logging to your ledger...');

      // 1. Prepare fields
      const numAmount = parseFloat(d.amount);
      const isExpense = true;
      const txAmount = -Math.abs(numAmount);
      const finalCategory = d.category || 'Shopping';
      const description = d.merchant || `${finalCategory} (Receipt)`;
      const paymentMethod = d.paymentMethod || 'Online / UPI';
      const cleanDate = d.date || new Date().toISOString().split('T')[0];

      // 2. Upload receipt image to Cloudinary
      let receiptUrl = asset.uri;
      try {
        const cloudRes = await uploadReceiptToCloudinary(asset.uri);
        if (cloudRes.success && cloudRes.url) {
          receiptUrl = cloudRes.url;
          console.log('[AutoLog Mobile] Stored receipt in Cloudinary:', receiptUrl);
        } else {
          console.warn('[AutoLog Mobile] Cloudinary notice, saving local URI:', cloudRes.error);
          receiptUrl = asset.uri;
        }
      } catch (uploadErr) {
        console.warn('[AutoLog Mobile] Cloudinary notice:', uploadErr);
        receiptUrl = asset.uri;
      }

      // 3. Write transaction to Firestore
      const docRef = await addDoc(collection(db, 'users', user.uid, 'transactions'), {
        amount: txAmount,
        category: finalCategory,
        description: description,
        paymentMethod: paymentMethod,
        date: cleanDate,
        notesSummary: null,
        createdAt: serverTimestamp(),
        receiptUrl: receiptUrl,
        source: 'receipt_autolog'
      });

      const savedTx = {
        id: docRef.id,
        amount: numAmount,
        category: finalCategory,
        description: description,
        paymentMethod: paymentMethod,
        date: cleanDate,
        receiptUrl: receiptUrl
      };

      // 4. Trigger system notification
      notifyTransaction({
        type: 'expense',
        amount: numAmount,
        category: finalCategory,
        paymentMethod: paymentMethod,
        transaction: savedTx
      });

      setLoggedData(savedTx);
      setStep('success');

      if (onTransactionLogged) {
        onTransactionLogged(savedTx);
      }
    } catch (err) {
      console.warn('[AutoLog] Processing error:', err);
      setErrorMessage(err.message || 'Could not auto-read receipt data.');
      setStep('error');
    }
  };

  const pickFromGallery = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Photo library access is needed to scan receipts.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      await processAndAutoLog(result.assets[0]);
    }
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Camera permission is needed to take receipt photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      await processAndAutoLog(result.assets[0]);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconBox}>
                <Camera size={18} color="#ffffff" />
              </View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.headerTitle, { color: isDarkMode ? '#f8fafc' : '#0f172a' }]}>
                    Auto-Log Receipt
                  </Text>
                  <View style={styles.aiBadge}>
                    <Sparkles size={9} color="#047857" />
                    <Text style={styles.aiBadgeText}>AI 100%</Text>
                  </View>
                </View>
                <Text style={styles.headerSubtitle}>
                  Zero manual typing • Automatically reads & logs
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={isDarkMode ? '#94a3b8' : '#64748b'} />
            </TouchableOpacity>
          </View>

          {/* STEP: Prompt (Camera or Gallery) */}
          {step === 'prompt' && (
            <View style={styles.body}>
              <View style={styles.bannerBox}>
                <Text style={styles.bannerTitle}>No form filling needed!</Text>
                <Text style={styles.bannerDesc}>
                  Just snap or upload your invoice / bill. SpendWise extracts the total, store name, category, and logs it directly.
                </Text>
              </View>

              <View style={styles.optionsContainer}>
                <TouchableOpacity 
                  activeOpacity={0.8}
                  onPress={takePhoto} 
                  style={[styles.bigActionBtn, { backgroundColor: '#10b981' }]}
                >
                  <View style={styles.btnIconWrap}>
                    <Camera size={26} color="#ffffff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.btnTitle}>Take Photo</Text>
                    <Text style={styles.btnDesc}>Use camera to scan physical receipt</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity 
                  activeOpacity={0.8}
                  onPress={pickFromGallery} 
                  style={[styles.bigActionBtn, { backgroundColor: isDarkMode ? '#334155' : '#f1f5f9' }]}
                >
                  <View style={[styles.btnIconWrap, { backgroundColor: isDarkMode ? '#475569' : '#e2e8f0' }]}>
                    <ImageIcon size={26} color={isDarkMode ? '#f8fafc' : '#0f172a'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.btnTitle, { color: isDarkMode ? '#f8fafc' : '#0f172a' }]}>
                      Upload from Gallery
                    </Text>
                    <Text style={[styles.btnDesc, { color: isDarkMode ? '#94a3b8' : '#64748b' }]}>
                      Select photo or digital receipt screenshot
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* STEP: Scanning / Saving */}
          {(step === 'scanning' || step === 'saving') && (
            <View style={styles.centerBody}>
              {pickedImageUri && (
                <Image 
                  source={{ uri: pickedImageUri }} 
                  style={styles.previewThumbnail} 
                  resizeMode="cover"
                />
              )}
              <ActivityIndicator size="large" color="#10b981" style={{ marginVertical: 14 }} />
              <Text style={[styles.statusText, { color: isDarkMode ? '#f8fafc' : '#0f172a' }]}>
                {statusMessage}
              </Text>
              <Text style={styles.statusSubtext}>
                Extracting amount, merchant, date and category...
              </Text>
            </View>
          )}

          {/* STEP: Success */}
          {step === 'success' && loggedData && (
            <View style={styles.body}>
              <View style={styles.successBanner}>
                <CheckCircle2 size={24} color="#10b981" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.successTitle}>Logged to Ledger!</Text>
                  <Text style={styles.successSubtitle}>Extracted and recorded with zero manual typing.</Text>
                </View>
              </View>

              {/* Data Card */}
              <View style={[styles.summaryCard, { backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc' }]}>
                <View style={styles.amountRow}>
                  <View>
                    <Text style={styles.amountLabel}>AMOUNT PAID</Text>
                    <Text style={styles.amountValue}>-{formatCurrency(loggedData.amount)}</Text>
                  </View>
                  <View style={styles.autoLoggedPill}>
                    <Text style={styles.autoLoggedPillText}>Auto-Logged</Text>
                  </View>
                </View>

                <View style={styles.detailsGrid}>
                  <View style={styles.detailItem}>
                    <Receipt size={14} color="#94a3b8" />
                    <Text style={[styles.detailText, { color: isDarkMode ? '#e2e8f0' : '#334155' }]} numberOfLines={1}>
                      {loggedData.description}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Tag size={14} color="#94a3b8" />
                    <Text style={[styles.detailText, { color: isDarkMode ? '#e2e8f0' : '#334155' }]} numberOfLines={1}>
                      {loggedData.category}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Calendar size={14} color="#94a3b8" />
                    <Text style={[styles.detailText, { color: isDarkMode ? '#e2e8f0' : '#334155' }]} numberOfLines={1}>
                      {loggedData.date}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <CreditCard size={14} color="#94a3b8" />
                    <Text style={[styles.detailText, { color: isDarkMode ? '#e2e8f0' : '#334155' }]} numberOfLines={1}>
                      {loggedData.paymentMethod}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Actions */}
              <View style={styles.successActionsRow}>
                <TouchableOpacity 
                  onPress={resetState} 
                  style={[styles.actionBtnSecondary, { borderColor: isDarkMode ? '#334155' : '#e2e8f0' }]}
                >
                  <RotateCcw size={15} color={isDarkMode ? '#cbd5e1' : '#475569'} />
                  <Text style={[styles.actionBtnSecondaryText, { color: isDarkMode ? '#cbd5e1' : '#475569' }]}>
                    Scan Another
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={handleClose} 
                  style={styles.actionBtnPrimary}
                >
                  <Text style={styles.actionBtnPrimaryText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* STEP: Error */}
          {step === 'error' && (
            <View style={styles.centerBody}>
              <View style={styles.errorIconWrap}>
                <AlertCircle size={32} color="#ef4444" />
              </View>
              <Text style={[styles.statusText, { color: isDarkMode ? '#f8fafc' : '#0f172a' }]}>
                Could Not Read Receipt
              </Text>
              <Text style={styles.statusSubtext}>
                {errorMessage}
              </Text>

              <View style={styles.successActionsRow}>
                <TouchableOpacity 
                  onPress={resetState} 
                  style={styles.actionBtnPrimary}
                >
                  <Text style={styles.actionBtnPrimaryText}>Try Another Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={handleClose} 
                  style={[styles.actionBtnSecondary, { borderColor: isDarkMode ? '#334155' : '#e2e8f0' }]}
                >
                  <Text style={[styles.actionBtnSecondaryText, { color: isDarkMode ? '#cbd5e1' : '#475569' }]}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 16,
    paddingBottom: 36,
    paddingHorizontal: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 1,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  aiBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#047857',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
  },
  body: {
    paddingTop: 18,
    gap: 16,
  },
  bannerBox: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 16,
    padding: 14,
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#065f46',
  },
  bannerDesc: {
    fontSize: 11,
    color: '#047857',
    marginTop: 2,
    lineHeight: 16,
  },
  optionsContainer: {
    gap: 12,
  },
  bigActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 20,
  },
  btnIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  btnDesc: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  centerBody: {
    paddingVertical: 36,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  previewThumbnail: {
    width: 100,
    height: 120,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#10b981',
  },
  statusText: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 8,
  },
  statusSubtext: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ecfdf5',
    padding: 12,
    borderRadius: 14,
  },
  successTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#065f46',
  },
  successSubtitle: {
    fontSize: 11,
    color: '#047857',
  },
  summaryCard: {
    padding: 14,
    borderRadius: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  amountLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  amountValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ef4444',
  },
  autoLoggedPill: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  autoLoggedPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#047857',
  },
  detailsGrid: {
    gap: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 12,
    fontWeight: '600',
  },
  successActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  actionBtnPrimary: {
    flex: 1,
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnPrimaryText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnSecondaryText: {
    fontSize: 13,
    fontWeight: '800',
  },
  errorIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
});

