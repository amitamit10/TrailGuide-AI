# TrailGuide AI — Phase 52: Mobile Authentication

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build sign-in and sign-up screens for the mobile app using Supabase Auth. After authentication, the user is redirected to the main tabs. On cold launch, the Supabase session is restored from SecureStore automatically (no re-login required).

**Architecture:** Expo Router's auth protection pattern: `app/(auth)/` contains login and signup screens, `app/(tabs)/` contains the authenticated app. Root `_layout.tsx` checks the Supabase session and redirects between `(auth)` and `(tabs)` groups. No separate navigation library.

**Tech Stack:** Expo Router 3, Supabase Auth, `expo-secure-store` (session persistence, already wired in Phase 51).

**Prerequisite:** Phase 51 (mobile foundation, SupabaseProvider, Expo Router).

## Global Constraints
- Session is persisted in SecureStore (already configured in Phase 51 — no extra code needed).
- Sign-in uses Supabase `signInWithPassword` (email + password).
- Sign-up uses `signUp` then waits for email confirmation if Supabase requires it.
- On sign-out, navigate to `/(auth)/login` and clear any in-memory state.
- No OAuth (Apple Sign-In, Google) in this phase — email/password only.
- All error messages from Supabase are shown in a red toast-style banner.

---

## Task 1: Auth protection in root layout

- [ ] **Step 1: Update `mobile/app/_layout.tsx`** — redirect based on session

```tsx
import { useEffect } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useSupabase } from "@/lib/supabase";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { session, loading } = useSupabase();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;
    SplashScreen.hideAsync();

    const inAuthGroup = segments[0] === "(auth)";

    if (!session && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      router.replace("/(tabs)/dashboard");
    }
  }, [session, loading, segments]);

  if (loading) return null;

  return <Slot />;
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/app/_layout.tsx
git commit -m "feat: add session-based route protection in root Expo Router layout"
```

---

## Task 2: Login screen

- [ ] **Step 1: Create `mobile/app/(auth)/_layout.tsx`**

```tsx
import { Stack } from "expo-router";

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }}/>;
}
```

- [ ] **Step 2: Create `mobile/app/(auth)/login.tsx`**

```tsx
import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { Link } from "expo-router";
import { useSupabase } from "@/lib/supabase";

export default function LoginScreen() {
  const { supabase } = useSupabase();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function signIn() {
    if (!email || !password) { setError("Email and password required"); return; }
    setLoading(true); setError("");
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) { setError(err.message); return; }
    // Navigation handled automatically by _layout.tsx session watcher
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View className="flex-1 justify-center px-6">
        {/* Logo */}
        <View className="items-center mb-12">
          <Text className="text-5xl mb-2">✈️</Text>
          <Text className="text-3xl font-bold text-brand">TrailGuide</Text>
          <Text className="text-base text-gray-500 mt-1">AI-Planned Adventures</Text>
        </View>

        {/* Error banner */}
        {error ? (
          <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
            <Text className="text-red-700 text-sm">{error}</Text>
          </View>
        ) : null}

        {/* Email */}
        <Text className="text-sm font-medium text-on-surface mb-1">Email</Text>
        <TextInput
          className="bg-white border border-gray-200 rounded-xl px-4 py-3.5 mb-4 text-on-surface text-base"
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
          accessibilityLabel="Email address"
        />

        {/* Password */}
        <Text className="text-sm font-medium text-on-surface mb-1">Password</Text>
        <TextInput
          className="bg-white border border-gray-200 rounded-xl px-4 py-3.5 mb-6 text-on-surface text-base"
          placeholder="••••••••"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          accessibilityLabel="Password"
        />

        {/* Sign in button */}
        <TouchableOpacity
          className={`bg-brand rounded-2xl py-4 items-center ${loading ? "opacity-60" : ""}`}
          onPress={signIn}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Sign in"
        >
          <Text className="text-white font-semibold text-base">
            {loading ? "Signing in…" : "Sign in"}
          </Text>
        </TouchableOpacity>

        {/* Sign up link */}
        <View className="flex-row justify-center mt-5">
          <Text className="text-gray-500 text-sm">New to TrailGuide? </Text>
          <Link href="/(auth)/signup">
            <Text className="text-brand font-medium text-sm">Create account</Text>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add mobile/app/\(auth\)/
git commit -m "feat: add login screen with Supabase email/password auth"
```

---

## Task 3: Sign-up screen

- [ ] **Step 1: Create `mobile/app/(auth)/signup.tsx`**

```tsx
import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Link } from "expo-router";
import { useSupabase } from "@/lib/supabase";

export default function SignupScreen() {
  const { supabase } = useSupabase();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function signUp() {
    if (!name || !email || !password) { setError("All fields are required"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true); setError("");

    const { error: err } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: name } },
    });
    setLoading(false);

    if (err) { setError(err.message); return; }
    // If Supabase requires email confirmation:
    setSuccess(true);
  }

  if (success) {
    return (
      <View className="flex-1 bg-surface justify-center px-6 items-center">
        <Text className="text-5xl mb-4">📧</Text>
        <Text className="text-xl font-bold text-on-surface text-center mb-2">Check your email</Text>
        <Text className="text-sm text-gray-500 text-center mb-8">
          We sent a confirmation link to {email}. Click it to activate your account.
        </Text>
        <Link href="/(auth)/login">
          <Text className="text-brand font-medium">Back to login</Text>
        </Link>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-surface" behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerClassName="flex-grow justify-center px-6 py-12">
        <View className="items-center mb-10">
          <Text className="text-3xl font-bold text-brand">Create account</Text>
          <Text className="text-gray-500 mt-1">Start planning your adventures</Text>
        </View>

        {error ? (
          <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
            <Text className="text-red-700 text-sm">{error}</Text>
          </View>
        ) : null}

        <Text className="text-sm font-medium text-on-surface mb-1">Name</Text>
        <TextInput
          className="bg-white border border-gray-200 rounded-xl px-4 py-3.5 mb-4 text-on-surface text-base"
          placeholder="Your name" autoCapitalize="words"
          value={name} onChangeText={setName}
          accessibilityLabel="Your name"
        />

        <Text className="text-sm font-medium text-on-surface mb-1">Email</Text>
        <TextInput
          className="bg-white border border-gray-200 rounded-xl px-4 py-3.5 mb-4 text-on-surface text-base"
          placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none"
          value={email} onChangeText={setEmail}
          accessibilityLabel="Email address"
        />

        <Text className="text-sm font-medium text-on-surface mb-1">Password</Text>
        <TextInput
          className="bg-white border border-gray-200 rounded-xl px-4 py-3.5 mb-6 text-on-surface text-base"
          placeholder="At least 8 characters" secureTextEntry
          value={password} onChangeText={setPassword}
          accessibilityLabel="Password"
        />

        <TouchableOpacity
          className={`bg-brand rounded-2xl py-4 items-center ${loading ? "opacity-60" : ""}`}
          onPress={signUp} disabled={loading}
          accessibilityRole="button" accessibilityLabel="Create account"
        >
          <Text className="text-white font-semibold text-base">
            {loading ? "Creating account…" : "Create account"}
          </Text>
        </TouchableOpacity>

        <View className="flex-row justify-center mt-5">
          <Text className="text-gray-500 text-sm">Already have an account? </Text>
          <Link href="/(auth)/login">
            <Text className="text-brand font-medium text-sm">Sign in</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/app/\(auth\)/signup.tsx
git commit -m "feat: add sign-up screen with email confirmation flow"
```

---

## Task 4: Sign-out

- [ ] **Step 1: Add `useAuth` hook for sign-out**

Create `mobile/hooks/useAuth.ts`:
```typescript
import { useSupabase } from "@/lib/supabase";

export function useAuth() {
  const { supabase, session } = useSupabase();

  async function signOut() {
    await supabase.auth.signOut();
    // Navigation handled by _layout.tsx session watcher
  }

  return { session, signOut, user: session?.user ?? null };
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/hooks/useAuth.ts
git commit -m "feat: add useAuth hook with sign-out functionality"
```

---

## Verification Checklist

- [ ] Cold launch (no session) → shows Login screen
- [ ] Sign in with valid credentials → navigates to dashboard (tab bar)
- [ ] Sign in with wrong password → shows error banner
- [ ] Sign up → confirmation email sent, success screen shown
- [ ] Kill app and relaunch while signed in → stays on dashboard (session persisted via SecureStore)
- [ ] Sign out → returns to Login screen
- [ ] Keyboard does not obscure input fields (KeyboardAvoidingView works)
- [ ] Login and signup screens have no header (headerShown: false)
