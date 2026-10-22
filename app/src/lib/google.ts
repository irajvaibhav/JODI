import { Platform } from 'react-native';

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

export const googleEnabled = Platform.OS !== 'web' && !!WEB_CLIENT_ID;

const lib = () => import('@react-native-google-signin/google-signin');

export async function googleIdToken(): Promise<string | null> {
  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = await lib();
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const r = await GoogleSignin.signIn();
    return isSuccessResponse(r) ? r.data.idToken : null;
  } catch (e) {
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.IN_PROGRESS) return null;
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) throw new Error('Google Play Services is needed for Google sign-in.');
      // DEVELOPER_ERROR: build SHA-1 not registered in Google Cloud
      if (String(e.code) === '10') throw new Error('Google sign-in isn\'t set up for this app build yet. Please use your phone number.');
    }
    throw new Error('Google sign-in failed. Please try again or use your phone number.');
  }
}

export async function googleSignOut() {
  if (!googleEnabled) return;
  const { GoogleSignin } = await lib();
  await GoogleSignin.signOut().catch(() => {});
}
