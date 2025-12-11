import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useChallengeStore } from '@store/challengeStore';
import { useWorkoutStore } from '@store/workoutStore';
import { SESSION_CHALLENGES, WEEKLY_CHALLENGES, ACHIEVEMENTS } from '@services/challengeDefinitions';
import type { ChallengeDefinition, ChallengeProgress } from '@types/index';

type Tab = 'active' | 'badges';

function ChallengeCard({
  def,
  progress,
}: {
  def: ChallengeDefinition;
  progress: ChallengeProgress | undefined;
}) {
  const current = progress?.current ?? 0;
  const isCompleted = (progress?.completedAt ?? null) !== null;
  const pct = Math.min(100, (current / def.target) * 100);

  return (
    <View style={[styles.card, isCompleted && styles.cardCompleted]}>
      <View style={[styles.cardIconWrap, isCompleted && { borderColor: def.color }]}>
        <Ionicons
          name={def.icon as any}
          size={20}
          color={isCompleted ? def.color : '#3a3a4a'}
        />
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle}>{def.title}</Text>
        <Text style={styles.cardDesc}>{def.description}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: isCompleted ? def.color : '#3a3a4a' }]} />
        </View>
        <Text style={styles.progressLabel}>
          {current >= def.target
            ? `✓ ${def.target} ${def.unit}`
            : `${Math.round(current)} / ${def.target} ${def.unit}`}
        </Text>
      </View>
      {isCompleted && (
        <Ionicons name="checkmark-circle" size={22} color="#60f090" />
      )}
    </View>
  );
}

function BadgeGrid() {
  const { unlockedAchievements } = useChallengeStore();
  const unlockedIds = new Set(unlockedAchievements.map((a) => a.id));

  return (
    <View style={styles.badgeGrid}>
      {ACHIEVEMENTS.map((def) => {
        const unlocked = unlockedIds.has(def.id);
        const achievement = unlockedAchievements.find((a) => a.id === def.id);
        return (
          <View key={def.id} style={[styles.badge, unlocked && styles.badgeUnlocked]}>
            <View style={[styles.badgeIcon, unlocked && { backgroundColor: `${def.color}22`, borderColor: def.color }]}>
              <Ionicons
                name={def.icon as any}
                size={28}
                color={unlocked ? def.color : '#2a2a35'}
              />
            </View>
            <Text style={[styles.badgeName, unlocked && styles.badgeNameUnlocked]} numberOfLines={2}>
              {def.title}
            </Text>
            {unlocked && achievement && (
              <Text style={styles.badgeDate}>
                {new Date(achievement.unlockedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </Text>
            )}
            {!unlocked && (
              <View style={styles.badgeLock}>
                <Ionicons name="lock-closed" size={10} color="#3a3a4a" />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

export default function ChallengesScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('active');
  const { sessionProgress, weeklyProgress, unlockedAchievements, evaluateAll } = useChallengeStore();

  // Re-evaluate weekly + achievement challenges on screen focus
  useEffect(() => {
    const state = useWorkoutStore.getState();
    evaluateAll({
      sessionSets: [],
      allSets: state.sets,
      sessions: state.sessions,
      exercises: state.exercises,
      currentSessionId: null,
      getPersonalRecord: state.getPersonalRecord,
      getStreakWeeks: state.getStreakWeeks,
    }).catch(() => {});
  }, []);

  const unlockedCount = unlockedAchievements.length;
  const totalBadges = ACHIEVEMENTS.length;

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Défis</Text>
        <View style={styles.headerBadge}>
          <Ionicons name="trophy" size={13} color="#f0c060" />
          <Text style={styles.headerBadgeText}>{unlockedCount}/{totalBadges}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'active' && styles.tabActive]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>En cours</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'badges' && styles.tabActive]}
          onPress={() => setActiveTab('badges')}
        >
          <Text style={[styles.tabText, activeTab === 'badges' && styles.tabTextActive]}>Badges</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'active' ? (
          <>
            <Text style={styles.sectionTitle}>Cette séance</Text>
            <Text style={styles.sectionHint}>Mis à jour en temps réel pendant l'entraînement</Text>
            {SESSION_CHALLENGES.map((def) => (
              <ChallengeCard key={def.id} def={def} progress={sessionProgress[def.id]} />
            ))}

            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Cette semaine</Text>
            <Text style={styles.sectionHint}>Réinitialisé chaque semaine</Text>
            {WEEKLY_CHALLENGES.map((def) => (
              <ChallengeCard key={def.id} def={def} progress={weeklyProgress[def.id]} />
            ))}
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Badges permanents</Text>
            <Text style={styles.sectionHint}>{unlockedCount} débloqué{unlockedCount > 1 ? 's' : ''} sur {totalBadges}</Text>
            <BadgeGrid />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f0f12' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: { color: '#f0f0f0', fontSize: 26, fontWeight: '800' },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1a1a22',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#2a2a35',
  },
  headerBadgeText: { color: '#f0c060', fontSize: 13, fontWeight: '700' },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 4,
    backgroundColor: '#16161c',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#2a2a35',
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 9,
  },
  tabActive: { backgroundColor: '#c8f060' },
  tabText: { color: '#7a7a90', fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: '#0f0f12' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  sectionTitle: { color: '#f0f0f0', fontSize: 17, fontWeight: '700', marginBottom: 4 },
  sectionHint: { color: '#5a5a70', fontSize: 12, marginBottom: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#16161c',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a2a35',
  },
  cardCompleted: { borderColor: '#60f09040' },
  cardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0f0f12',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2a2a35',
    flexShrink: 0,
  },
  cardInfo: { flex: 1, gap: 4 },
  cardTitle: { color: '#f0f0f0', fontSize: 14, fontWeight: '700' },
  cardDesc: { color: '#5a5a70', fontSize: 12 },
  progressTrack: {
    height: 4,
    backgroundColor: '#2a2a35',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: { height: '100%', borderRadius: 2 },
  progressLabel: { color: '#7a7a90', fontSize: 11, fontWeight: '600' },
  // Badges grid
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  badge: {
    width: '30%',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#16161c',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2a2a35',
    position: 'relative',
  },
  badgeUnlocked: { borderColor: '#2a2a3a' },
  badgeIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f0f12',
    borderWidth: 1,
    borderColor: '#2a2a35',
  },
  badgeName: { color: '#3a3a4a', fontSize: 11, fontWeight: '600', textAlign: 'center' },
  badgeNameUnlocked: { color: '#f0f0f0' },
  badgeDate: { color: '#5a5a70', fontSize: 10, textAlign: 'center' },
  badgeLock: { position: 'absolute', top: 8, right: 8 },
});
