import { Platform } from 'react-native';

// Web OAuth client ID from Google Cloud (it's what makes Google return an idToken the API can verify).
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

// Native module only: hidden in the web preview and until the client ID is configured.
export const googleEnabled = Platform.OS !== 'web' && !!WEB_CLIENT_ID;

const lib = () => import('@react-native-google-signin/google-signin');

/** Opens Google's account picker. Returns an idToken, or null if the user cancelled. */
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
      // DEVELOPER_ERROR (10) = this build's SHA-1 isn't registered as an Android OAuth client in Google Cloud.
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
