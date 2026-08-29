import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Radius } from '@/constants/theme';
import { REDEEM_POINTS, REDEEM_VALUE, useApp } from '@/lib/store';
import { PointsEvent } from '@/lib/types';

export default function RewardsScreen() {
  const { session, signOut, applyReferralCode } = useApp();
  const points = session?.points ?? 0;
  const progress = Math.min(1, (points % REDEEM_POINTS) / REDEEM_POINTS);
  const redeemable = Math.floor(points / REDEEM_POINTS);
  const [friendCode, setFriendCode] = useState('');
  const [refMsg, setRefMsg] = useState('');
  const alreadyReferred = (session?.credit ?? 0) > 0;

  const onApplyReferral = async () => {
    if (!friendCode.trim()) return;
    const ok = await applyReferralCode(friendCode.trim());
    setRefMsg(ok ? 'Applied! You both get $5 after your first delivery.' : 'Invalid or already-used code.');
    if (ok) setFriendCode('');
  };

  const renderEvent = ({ item }: { item: PointsEvent }) => (
    <View style={styles.eventRow}>
      <Text style={styles.eventReason}>{item.reason}</Text>
      <Text style={[styles.eventDelta, item.delta < 0 && styles.eventNegative]}>
        {item.delta > 0 ? '+' : ''}
        {item.delta}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>Rewards</Text>

      <View style={styles.hero}>
        <Text style={styles.heroPoints}>{points}</Text>
        <Text style={styles.heroLabel}>points</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.heroHint}>
          {redeemable > 0
            ? `You can redeem ${REDEEM_POINTS} points for $${REDEEM_VALUE} off at checkout`
            : `${REDEEM_POINTS - (points % REDEEM_POINTS)} more points until $${REDEEM_VALUE} off`}
        </Text>
      </View>

      <View style={styles.howCard}>
        <Text style={styles.howTitle}>How it works</Text>
        <Text style={styles.howLine}>Earn 1 point per $1 spent</Text>
        <Text style={styles.howLine}>
          {REDEEM_POINTS} points = ${REDEEM_VALUE} off any order
        </Text>
        <Text style={styles.howLine}>200-point welcome bonus for new students</Text>
      </View>

      <View style={styles.refCard}>
        <Text style={styles.refTitle}>Give $5, get $5</Text>
        <Text style={styles.refSub}>
          Share your code. When a friend joins and gets their first order, you both get $5 credit.
        </Text>
        {(session?.credit ?? 0) > 0 && (
          <Text style={styles.refCredit}>${(session?.credit ?? 0).toFixed(2)} credit — applied at checkout</Text>
        )}
        <View style={styles.codeBox}>
          <Text style={styles.codeText}>{session?.referralCode ?? '—'}</Text>
          <Text style={styles.codeShare}>your code</Text>
        </View>
        {!alreadyReferred && (
          <>
            <View style={styles.friendRow}>
              <TextInput
                style={styles.friendInput}
                placeholder="Enter a friend's code"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="characters"
                value={friendCode}
                onChangeText={setFriendCode}
              />
              <Pressable style={styles.friendBtn} onPress={onApplyReferral}>
                <Text style={styles.friendBtnText}>Apply</Text>
              </Pressable>
            </View>
            {refMsg ? <Text style={styles.refMsg}>{refMsg}</Text> : null}
          </>
        )}
      </View>

      <Text style={styles.sectionTitle}>Activity</Text>
      <FlatList
        data={session?.ledger ?? []}
        keyExtractor={(e) => e.id}
        renderItem={renderEvent}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>No activity yet</Text>}
      />

      <Pressable style={styles.signOut} onPress={signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  title: { fontSize: 24, fontWeight: '800', color: Colors.text, padding: 16 },
  hero: {
    marginHorizontal: 16,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    padding: 24,
    alignItems: 'center',
  },
  heroPoints: { fontSize: 40, fontWeight: '800', color: '#fff' },
  heroLabel: { color: '#FECACA', fontSize: 14, marginBottom: 16 },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  progressFill: { height: 8, backgroundColor: Colors.gold, borderRadius: 4 },
  heroHint: { color: '#fff', fontSize: 13, marginTop: 12, textAlign: 'center' },
  howCard: {
    margin: 16,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  howTitle: { fontWeight: '800', color: Colors.text, marginBottom: 4 },
  howLine: { color: Colors.textMuted, fontSize: 14 },
  sectionTitle: { fontWeight: '800', color: Colors.text, paddingHorizontal: 16, fontSize: 16 },
  refCard: {
    margin: 16,
    marginTop: 0,
    backgroundColor: Colors.tint,
    borderRadius: Radius.lg,
    padding: 16,
  },
  refTitle: { fontWeight: '800', color: Colors.primaryDark, fontSize: 16 },
  refSub: { color: Colors.primaryDark, fontSize: 13, marginTop: 4, opacity: 0.9 },
  refCredit: { color: Colors.success, fontWeight: '800', marginTop: 8 },
  codeBox: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: 12,
    marginTop: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  codeText: { fontWeight: '800', fontSize: 20, color: Colors.text, letterSpacing: 1 },
  codeShare: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  friendRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  friendInput: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text,
  },
  friendBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  friendBtnText: { color: '#fff', fontWeight: '700' },
  refMsg: { marginTop: 8, color: Colors.primaryDark, fontWeight: '600', fontSize: 13 },
  list: { padding: 16, gap: 10 },
  eventRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  eventReason: { color: Colors.text, fontSize: 14, flex: 1 },
  eventDelta: { fontWeight: '800', color: Colors.success },
  eventNegative: { color: Colors.primary },
  emptyText: { color: Colors.textMuted, textAlign: 'center' },
  signOut: { padding: 16, alignItems: 'center' },
  signOutText: { color: Colors.textMuted, fontWeight: '600' },
});
