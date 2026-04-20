"use client";

import { AuthProvider } from "react-oidc-context";

const cognitoAuthConfig = {
  authority: "https://cognito-idp.us-west-2.amazonaws.com/us-west-2_9f3t2Op3i",
  client_id: "5vv9c1qg1aat2qh5bkfm6d44ma",
  redirect_uri: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  response_type: "code",
  scope: "openid email profile",
  onSigninCallback: () => {
    // Clean up the URL after Cognito redirects back (?code=...&state=...)
    window.history.replaceState({}, document.title, window.location.pathname);
  },
};

export default function CognitoAuthProvider({ children }) {
  return <AuthProvider {...cognitoAuthConfig}>{children}</AuthProvider>;
}
