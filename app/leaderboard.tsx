import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@services/supabase';
import { useAuthStore } from '@store/authStore';
import type { LeaderboardEntry } from '@types/index';

const MEDAL_COLORS = ['#f0c060', '#c0c0c0', '#c07040'];

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <View style={[styles.medal, { backgroundColor: MEDAL_COLORS[rank - 1] }]}>
        <Ionicons name="trophy" size={14} color="#0f0f12" />
      </View>
    );
  }
  return (
    <View style={styles.rankCircle}>
      <Text style={styles.rankText}>{rank}</Text>
    </View>
  );
}

export default function LeaderboardScreen() {
  const user = useAuthStore((s) => s.user);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myEntry, setMyEntry] = useState<LeaderboardEntry | null>(null);

  const loadLeaderboard = useCallback(async () => {
    try {
      // Query aggregated session & set stats per user
      const { data, error } = await supabase
        .from('sessions')
        .select('user_id, sets(weight, repetitions)')
        .not('user_id', 'is', null);

      if (error) throw error;

      // Aggregate by user
      const userMap: Record<string, { totalVolume: number; totalSessions: number }> = {};
      for (const session of data ?? []) {
        if (!session.user_id) continue;
        const uid = session.user_id;
        const sets = (session as any).sets as { weight: number; repetitions: number }[];
        const vol = (sets ?? []).reduce((sum, s) => sum + s.weight * s.repetitions, 0);
        if (!userMap[uid]) userMap[uid] = { totalVolume: 0, totalSessions: 0 };
        userMap[uid].totalVolume += vol;
        userMap[uid].totalSessions++;
      }

      const sorted = Object.entries(userMap)
        .sort(([, a], [, b]) => b.totalVolume - a.totalVolume)
        .slice(0, 20)
        .map(([userId, stats], i) => ({
          user_id: userId,
          username: userId.substring(0, 8) + '…',
          avatar_url: null,
          total_volume: Math.round(stats.totalVolume),
          total_sessions: stats.totalSessions,
          streak_weeks: 0,
          rank: i + 1,
        }));

      setEntries(sorted);
      const me = sorted.find((e) => e.user_id === user?.id) ?? null;
      setMyEntry(me);
    } catch (error) {
      console.error('[leaderboard] load:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadLeaderboard(); }, [loadLeaderboard]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLeaderboard();
    setRefreshing(false);
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#c8f060" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* My rank banner */}
      {myEntry && (
        <LinearGradient colors={['#1a2a10', '#0f0f12']} style={styles.myBanner}>
          <View style={styles.myLeft}>
            <RankBadge rank={myEntry.rank} />
            <View>
              <Text style={styles.myLabel}>Your rank</Text>
              <Text style={styles.myRank}>#{myEntry.rank}</Text>
            </View>
          </View>
          <View style={styles.myStats}>
            <View style={styles.myStat}>
              <Text style={styles.myStatValue}>{(myEntry.total_volume / 1000).toFixed(1)}t</Text>
              <Text style={styles.myStatLabel}>Volume</Text>
            </View>
            <View style={styles.myStat}>
              <Text style={styles.myStatValue}>{myEntry.total_sessions}</Text>
              <Text style={styles.myStatLabel}>Sessions</Text>
            </View>
          </View>
        </LinearGradient>
      )}

      <FlatList
        data={entries}
        keyExtractor={(item) => item.user_id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#c8f060" />}
        renderItem={({ item }) => {
          const isMe = item.user_id === user?.id;
          return (
            <View style={[styles.entry, isMe && styles.entryMe]}>
              <RankBadge rank={item.rank} />
              <View style={styles.entryAvatar}>
                <Text style={styles.entryAvatarText}>
                  {item.username[0].toUpperCase()}
                </Text>
              </View>
              <View style={styles.entryInfo}>
                <Text style={[styles.entryName, isMe && styles.entryNameMe]}>
                  {isMe ? 'You' : item.username}
                </Text>
                <Text style={styles.entrySessions}>{item.total_sessions} sessions</Text>
              </View>
              <View style={styles.entryVolume}>
                <Text style={styles.entryVolumeValue}>
                  {(item.total_volume / 1000).toFixed(1)}t
                </Text>
                <Text style={styles.entryVolumeLabel}>volume</Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="trophy-outline" size={52} color="#2a2a35" />
            <Text style={styles.emptyTitle}>No data yet</Text>
            <Text style={styles.emptyText}>Start logging workouts to appear on the leaderboard!</Text>
          </View>
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f12' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  myBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#2a2a35',
  },
  myLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  myLabel: { color: '#7a7a90', fontSize: 12 },
  myRank: { color: '#c8f060', fontSize: 24, fontWeight: '800' },
  myStats: { flexDirection: 'row', gap: 20 },
  myStat: { alignItems: 'center' },
  myStatValue: { color: '#f0f0f0', fontSize: 18, fontWeight: '800' },
  myStatLabel: { color: '#7a7a90', fontSize: 11 },
  list: { padding: 16, gap: 8, paddingBottom: 48 },
  entry: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#16161c', borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: '#2a2a35', gap: 10,
  },
  entryMe: { borderColor: '#c8f060', backgroundColor: 'rgba(200,240,96,0.06)' },
  medal: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  rankCircle: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#2a2a35', alignItems: 'center', justifyContent: 'center',
  },
  rankText: { color: '#7a7a90', fontSize: 13, fontWeight: '700' },
  entryAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#2a2a35', alignItems: 'center', justifyContent: 'center',
  },
  entryAvatarText: { color: '#f0f0f0', fontSize: 16, fontWeight: '700' },
  entryInfo: { flex: 1 },
  entryName: { color: '#f0f0f0', fontSize: 14, fontWeight: '600' },
  entryNameMe: { color: '#c8f060' },
  entrySessions: { color: '#7a7a90', fontSize: 12, marginTop: 2 },
  entryVolume: { alignItems: 'flex-end' },
  entryVolumeValue: { color: '#f0f0f0', fontSize: 16, fontWeight: '800' },
  entryVolumeLabel: { color: '#7a7a90', fontSize: 10 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 10, padding: 24 },
  emptyTitle: { color: '#f0f0f0', fontSize: 18, fontWeight: '700' },
  emptyText: { color: '#7a7a90', fontSize: 14, textAlign: 'center' },
});
