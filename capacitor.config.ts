// Capacitor configuration for building a native Android APK when desired.
// To wrap into Android:
//   npm install @capacitor/core @capacitor/cli @capacitor/android
//   npm run build && npx cap add android && npx cap sync android
const config = {
  appId: 'id.dippa.lifehub',
  appName: 'LifeHub',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#FAFAF9',
  },
};

export default config;
