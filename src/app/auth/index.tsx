import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { useRouter } from 'expo-router';
import type { ApplicationVerifier, ConfirmationResult } from 'firebase/auth';
import { signInWithPhoneNumber } from 'firebase/auth';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GradientButton } from '@/components/GradientButton';
import { Colors, Fonts, Radius, Shadow } from '@/constants/theme';
import { UNL } from '@/lib/campuses';
import { firebaseAuth, firebaseConfig, firebaseEnabled } from '@/lib/firebase';
import { DEV_OTP, useApp } from '@/lib/store';

export default function AuthScreen() {
  const router = useRouter();
  const { sendCode, verifyCode, verifyFirebaseToken } = useApp();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const campusId = UNL.id; // UNL-only launch
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Firebase phone-auth handles (only used when firebaseEnabled).
  const recaptcha = useRef<FirebaseRecaptchaVerifierModal>(null);
  const confirmation = useRef<ConfirmationResult | null>(null);

  const digits = phone.replace(/\D/g, '');
  const phoneValid = digits.length === 10;

  const onSend = async () => {
    if (!phoneValid) {
      setError('Enter a 10-digit phone number');
      return;
    }
    setError('');
    setBusy(true);
    try {
      if (firebaseEnabled && firebaseAuth && recaptcha.current) {
        // Firebase sends the SMS after the reCAPTCHA challenge.
        confirmation.current = await signInWithPhoneNumber(
          firebaseAuth,
          `+1${digits}`,
          recaptcha.current as unknown as ApplicationVerifier
        );
      } else {
        await sendCode(digits);
      }
      setStep('code');
    } catch {
      setError(
        firebaseEnabled
          ? 'Couldn’t send the code — check the number and try again.'
          : 'Couldn’t reach the server — is the backend running?'
      );
    } finally {
      setBusy(false);
    }
  };

  const onVerify = async () => {
    setBusy(true);
    setError('');
    try {
      let ok = false;
      if (firebaseEnabled && confirmation.current) {
        const cred = await confirmation.current.confirm(code.trim());
        const idToken = await cred.user.getIdToken();
        ok = await verifyFirebaseToken(idToken, campusId);
      } else {
        ok = await verifyCode(digits, code.trim(), campusId);
      }
      if (ok) router.replace('/(tabs)');
      else setError('Wrong code — try again');
    } catch {
      setError('Wrong code — try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {firebaseEnabled && (
        <FirebaseRecaptchaVerifierModal
          ref={recaptcha}
          firebaseConfig={firebaseConfig}
          attemptInvisibleVerification
        />
      )}
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.logo}>
          BLIN<Text style={styles.logoAccent}>K</Text>
        </Text>
        <Text style={styles.tagline}>Late-night snacks, delivered in a blink. Now at UNL.</Text>

        {step === 'phone' ? (
          <View style={styles.form}>
            <View style={styles.campusPill}>
              <View style={styles.campusDot} />
              <Text style={styles.campusPillText}>University of Nebraska–Lincoln</Text>
            </View>

            <Text style={styles.label}>Phone number</Text>
            <TextInput
              style={styles.input}
              placeholder="(402) 555-0134"
              placeholderTextColor={Colors.textMuted}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              maxLength={14}
            />
            <View style={styles.cta}>
              <GradientButton
                label={busy ? 'Sending…' : 'Text me a code'}
                onPress={onSend}
                disabled={!phoneValid || busy}
                icon="arrow"
              />
            </View>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.label}>Enter the 6-digit code sent to {phone}</Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              placeholder="••••••"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
              value={code}
              onChangeText={setCode}
              maxLength={6}
              autoFocus
            />
            <View style={styles.cta}>
              <GradientButton label={busy ? 'Verifying…' : 'Verify'} onPress={onVerify} disabled={busy} />
            </View>
            <Pressable onPress={() => setStep('phone')}>
              <Text style={styles.link}>Change number</Text>
            </Pressable>
            {!firebaseEnabled && <Text style={styles.devHint}>Dev mode: the code is {DEV_OTP}</Text>}
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, padding: 24, justifyContent: 'center', maxWidth: 480, width: '100%', alignSelf: 'center' },
  logo: { fontFamily: Fonts.display, fontSize: 72, color: Colors.text, textAlign: 'center', letterSpacing: 1.5 },
  logoAccent: { fontFamily: Fonts.display, color: Colors.primary },
  tagline: { fontSize: 15.5, color: Colors.textMuted, textAlign: 'center', marginTop: 2, marginBottom: 40, lineHeight: 22 },
  form: { gap: 12 },
  label: { fontSize: 14, fontWeight: '700', color: Colors.text, marginLeft: 2 },
  campusPill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.card,
    borderRadius: Radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 12,
    ...Shadow.sm,
  },
  campusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  campusPillText: { color: Colors.text, fontWeight: '700', fontSize: 13 },
  input: {
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 18,
    backgroundColor: Colors.card,
    color: Colors.text,
    ...Shadow.sm,
  },
  codeInput: { textAlign: 'center', letterSpacing: 8, fontSize: 24, fontWeight: '700' },
  cta: { marginTop: 6 },
  link: { color: Colors.primary, textAlign: 'center', marginTop: 14, fontWeight: '700' },
  devHint: { color: Colors.textSoft, textAlign: 'center', marginTop: 16, fontSize: 12 },
  error: { color: Colors.primary, textAlign: 'center', marginTop: 16, fontWeight: '600' },
});
