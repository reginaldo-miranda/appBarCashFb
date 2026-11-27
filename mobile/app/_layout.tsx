import React, { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { Platform, useWindowDimensions } from "react-native";
import { AuthProvider } from "../src/contexts/AuthContext";
import { ProductProvider } from "../src/contexts/ProductContext";

import { SafeAreaView } from "react-native-safe-area-context";
import VoiceAssistantButton from "../src/components/VoiceAssistantButton";

// Versão ultra-simplificada para garantir que o app carregue
export default function RootLayout() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const onRejection = (e: any) => {
      const msg = String((e && e.reason && e.reason.message) || (e && e.reason) || "");
      if (msg.includes("timeout exceeded") || msg.includes("translations") || msg.includes("RegisterClientLocalizationsError")) {
        if (e && typeof e.preventDefault === "function") e.preventDefault();
      }
    };
    const onError = (e: any) => {
      const msg = String((e && e.message) || "");
      if (msg.includes("timeout exceeded") || msg.includes("translations") || msg.includes("RegisterClientLocalizationsError")) {
        if (e && typeof e.preventDefault === "function") e.preventDefault();
      }
    };
    if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.addEventListener === "function") {
      window.addEventListener("unhandledrejection", onRejection);
      window.addEventListener("error", onError);
    }
    return () => {
      if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.removeEventListener === "function") {
        window.removeEventListener("unhandledrejection", onRejection);
        window.removeEventListener("error", onError);
      }
    };
  }, []);
  
  useEffect(() => {
    // Carregamento simples sem dependências problemáticas
    const timer = setTimeout(() => {
      setReady(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);
  
  if (!ready) {
    return null;
  }
  
  return (
    <AuthProvider>
      <ProductProvider>
        <SafeAreaView style={{ flex: 1, paddingHorizontal: isMobile ? 10 : 0 }}>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login-simples" options={{ title: 'Login Simples' }} />
            <Stack.Screen name="login" options={{ title: 'Login' }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="tablet" options={{ headerShown: false }} />
            <Stack.Screen name="delivery-dashboard" options={{ headerShown: false }} />
            <Stack.Screen name="sale" options={{ headerShown: false }} />
            <Stack.Screen name="cardapio/index" options={{ headerShown: false }} />
            <Stack.Screen name="cardapio/[mesaId]" options={{ headerShown: false }} />
            <Stack.Screen name="cardapio/comanda/[comandaNome]" options={{ headerShown: false }} />
            <Stack.Screen name="TestScreen" options={{ title: 'Testes e Diagnóstico' }} />
          </Stack>
          <VoiceAssistantButton />
        </SafeAreaView>
      </ProductProvider>
    </AuthProvider>
  );
}