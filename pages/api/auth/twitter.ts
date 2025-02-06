import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID;
    // Generate a secure random state
    const state = crypto.randomBytes(16).toString('hex');
    // Generate code verifier (between 43-128 chars)
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    // Generate code challenge
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    // Store these in cookies for validation in callback
    res.setHeader('Set-Cookie', [
      `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax`,
      `code_verifier=${codeVerifier}; Path=/; HttpOnly; Secure; SameSite=Lax`,
    ]);

    const redirectUri = encodeURIComponent(`${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/twitter/callback`);
    
    const authUrl = `https://twitter.com/i/oauth2/authorize?` +
      `response_type=code` +
      `&client_id=${TWITTER_CLIENT_ID}` +
      `&redirect_uri=${redirectUri}` +
      `&scope=tweet.read%20users.read%20offline.access` +
      `&state=${state}` +
      `&code_challenge=${codeChallenge}` +
      `&code_challenge_method=S256`;

    console.log('Auth URL:', authUrl);
    res.redirect(authUrl);
  } catch (error) {
    console.error('Twitter auth failed:', error);
    res.redirect('/?error=auth_failed');
  }
} 