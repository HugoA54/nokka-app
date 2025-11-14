import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useNutritionStore } from '@store/nutritionStore';
import { useAuthStore } from '@store/authStore';
import type { Food } from '@types/index';

interface BarcodeScannerProps {
  onFound: (food: Food) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onFound, onClose }: BarcodeScannerProps) {
  const user = useAuthStore((s) => s.user);
  const { scanBarcode } = useNutritionStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBarcode = async (barcode: string) => {
    if (!isScanning || isLoading) return;
    setIsScanning(false);
    setIsLoading(true);
    setError(null);
    try {
      const food = await scanBarcode(barcode, user?.id ?? '');
      if (food) {
        onFound(food);
      } else {
        setError(`Product not found for barcode: ${barcode}`);
        setIsScanning(true);
      }
    } catch {
      setError('Failed to look up barcode. Check your connection.');
      setIsScanning(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSubmit = async () => {
    if (!manualBarcode.trim()) return;
    await handleBarcode(manualBarcode.trim());
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#c8f060" size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Ionicons name="camera-outline" size={60} color="#2a2a35" />
        <Text style={styles.permTitle}>Camera Access Required</Text>
        <Text style={styles.permText}>Nokka needs camera access to scan barcodes.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Access</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowManual(true)} style={styles.manualLink}>
          <Text style={styles.manualLinkText}>Enter barcode manually</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!showManual ? (
        <>
          <CameraView
            style={styles.camera}
            facing="back"
            onBarcodeScanned={isScanning ? (e) => handleBarcode(e.data) : undefined}
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr'] }}
          >
            {/* Overlay */}
            <View style={styles.overlay}>
              <View style={styles.topOverlay} />
              <View style={styles.middleRow}>
                <View style={styles.sideOverlay} />
                <View style={styles.scanBox}>
                  {/* Corner markers */}
                  <View style={[styles.corner, styles.topLeft]} />
                  <View style={[styles.corner, styles.topRight]} />
                  <View style={[styles.corner, styles.bottomLeft]} />
                  <View style={[styles.corner, styles.bottomRight]} />
                  {isLoading && (
                    <View style={styles.loadingOverlay}>
                      <ActivityIndicator color="#c8f060" size="large" />
                    </View>
                  )}
                </View>
                <View style={styles.sideOverlay} />
              </View>
              <View style={styles.bottomOverlay}>
                {error && (
                  <View style={styles.errorBanner}>
                    <Ionicons name="alert-circle" size={16} color="#f06060" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}
                <Text style={styles.hint}>Point camera at barcode</Text>
                <TouchableOpacity
                  style={styles.manualBtn}
                  onPress={() => setShowManual(true)}
                >
                  <Ionicons name="keypad-outline" size={16} color="#7a7a90" />
                  <Text style={styles.manualBtnText}>Enter manually</Text>
                </TouchableOpacity>
              </View>
            </View>
          </CameraView>

          {/* Close button */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={24} color="#f0f0f0" />
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.manualContainer}>
          <Text style={styles.manualTitle}>Enter Barcode</Text>
          <TextInput
            style={styles.manualInput}
            value={manualBarcode}
            onChangeText={setManualBarcode}
            placeholder="e.g. 3017620422003"
            placeholderTextColor="#3a3a4a"
            keyboardType="number-pad"
            autoFocus
            returnKeyType="search"
            onSubmitEditing={handleManualSubmit}
          />
          {error && <Text style={styles.manualError}>{error}</Text>}
          <View style={styles.manualActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowManual(false)}>
              <Text style={styles.cancelBtnText}>Use Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleManualSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#0f0f12" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Search</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f12',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },
  topOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  middleRow: {
    flexDirection: 'row',
    height: 250,
  },
  sideOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scanBox: {
    width: 250,
    height: 250,
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#c8f060',
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 4,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 24,
    gap: 12,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(240,96,96,0.15)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#f06060',
  },
  errorText: {
    color: '#f06060',
    fontSize: 13,
  },
  hint: {
    color: '#f0f0f0',
    fontSize: 15,
    fontWeight: '600',
  },
  manualBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(42,42,53,0.9)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  manualBtnText: {
    color: '#7a7a90',
    fontSize: 14,
    fontWeight: '600',
  },
  closeBtn: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Manual entry
  manualContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    gap: 20,
  },
  manualTitle: {
    color: '#f0f0f0',
    fontSize: 22,
    fontWeight: '700',
  },
  manualInput: {
    backgroundColor: '#16161c',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a2a35',
    paddingHorizontal: 20,
    paddingVertical: 16,
    color: '#f0f0f0',
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 2,
  },
  manualError: {
    color: '#f06060',
    fontSize: 13,
  },
  manualActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#2a2a35',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#f0f0f0',
    fontWeight: '600',
    fontSize: 15,
  },
  submitBtn: {
    flex: 1,
    backgroundColor: '#c8f060',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#0f0f12',
    fontWeight: '700',
    fontSize: 15,
  },
  permTitle: {
    color: '#f0f0f0',
    fontSize: 20,
    fontWeight: '700',
  },
  permText: {
    color: '#7a7a90',
    fontSize: 14,
    textAlign: 'center',
  },
  permBtn: {
    backgroundColor: '#c8f060',
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  permBtnText: {
    color: '#0f0f12',
    fontWeight: '700',
    fontSize: 16,
  },
  manualLink: {
    padding: 8,
  },
  manualLinkText: {
    color: '#7a7a90',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
