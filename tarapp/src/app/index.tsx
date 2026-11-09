import { Redirect } from 'expo-router';

export default function Index() {
  // the canvas owns the gates: terms → onboarding → home
  return <Redirect href="/canvas" />;
}
