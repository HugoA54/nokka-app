import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@store/authStore';
import { useTemplateStore } from '@store/templateStore';
import { useToast } from '@hooks/useToast';
import { useHaptics } from '@hooks/useHaptics';

export default function TemplatesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { templates, isLoading, fetchTemplates, createTemplate, deleteTemplate } =
    useTemplateStore();
  const toast = useToast();
  const haptics = useHaptics();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (user) fetchTemplates(user.id);
    }, [user?.id])
  );

  const handleCreate = async () => {
    if (!user || !newName.trim()) return;
    try {
      const tmpl = await createTemplate(user.id, newName.trim());
      setShowCreate(false);
      setNewName('');
      router.push(`/templates/${tmpl.id}`);
    } catch {
      toast.error(t('templates.failed_save'));
    }
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(t('templates.delete_title'), t('templates.delete_msg', { name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          haptics.medium();
          try {
            await deleteTemplate(id);
          } catch {
            toast.error(t('templates.failed_delete'));
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={templates}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
            <Ionicons name="add" size={20} color="#0f0f12" />
            <Text style={styles.addBtnText}>{t('templates.new_template')}</Text>
          </TouchableOpacity>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push(`/templates/${item.id}`)}
            onLongPress={() => handleDelete(item.id, item.name)}
            activeOpacity={0.8}
          >
            <View style={styles.rowIcon}>
              <Ionicons name="copy-outline" size={18} color="#c8f060" />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowName}>{item.name}</Text>
              {item.description ? (
                <Text style={styles.rowDesc} numberOfLines={1}>
                  {item.description}
                </Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={16} color="#3a3a4a" />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Ionicons name="copy-outline" size={52} color="#2a2a35" />
              <Text style={styles.emptyTitle}>{t('templates.no_templates')}</Text>
              <Text style={styles.emptyText}>{t('templates.create_first')}</Text>
            </View>
          ) : null
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      {/* Create modal */}
      <Modal
        visible={showCreate}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreate(false)}
      >
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.backdrop} onPress={() => setShowCreate(false)} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{t('templates.new_template')}</Text>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder={t('templates.name_placeholder')}
              placeholderTextColor="#3a3a4a"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />
            <TouchableOpacity style={styles.createBtn} onPress={handleCreate}>
              <Text style={styles.createBtnText}>{t('templates.save')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f12' },
  list: { padding: 16, gap: 10, paddingBottom: 40 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#c8f060',
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 8,
  },
  addBtnText: { color: '#0f0f12', fontSize: 16, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#16161c',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2a2a35',
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(200,240,96,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: { flex: 1 },
  rowName: { color: '#f0f0f0', fontSize: 15, fontWeight: '600' },
  rowDesc: { color: '#7a7a90', fontSize: 12, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 10, padding: 24 },
  emptyTitle: { color: '#f0f0f0', fontSize: 18, fontWeight: '700' },
  emptyText: { color: '#7a7a90', fontSize: 14, textAlign: 'center' },
  // Modal
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: '#16161c',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingTop: 16,
    gap: 16,
    borderWidth: 1,
    borderColor: '#2a2a35',
    borderBottomWidth: 0,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#3a3a4a',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  sheetTitle: { color: '#f0f0f0', fontSize: 20, fontWeight: '700' },
  input: {
    backgroundColor: '#0f0f12',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a35',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f0f0f0',
    fontSize: 16,
  },
  createBtn: {
    backgroundColor: '#c8f060',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  createBtnText: { color: '#0f0f12', fontSize: 16, fontWeight: '700' },
});
