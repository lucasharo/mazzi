import type { CapacitorConfig } from '@capacitor/cli';

const isProfessionalTarget = process.env.MAZZI_CAPACITOR_TARGET === 'pro';

const config: CapacitorConfig = {
  appId: isProfessionalTarget ? 'br.com.mazzi.pro' : 'br.com.mazzi.aluno',
  appName: isProfessionalTarget ? 'MAZZI PRO' : 'MAZZI Aluno',
  webDir: isProfessionalTarget ? 'dist/instructor' : 'dist/student',
  android: {
    path: isProfessionalTarget ? 'android-pro' : 'android',
    allowMixedContent: false,
    // The background-geolocation callback runs through the bridge. The legacy
    // bridge keeps it alive after Android backgrounds the PRO WebView.
    useLegacyBridge: isProfessionalTarget,
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
    },
  },
};

export default config;
