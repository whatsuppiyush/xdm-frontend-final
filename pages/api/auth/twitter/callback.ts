import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, state } = req.query;
  const storedState = req.cookies['oauth_state'];
  const codeVerifier = req.cookies['code_verifier'];

  if (!code) {
    return res.redirect('/?error=no_code');
  }

  if (!state || !storedState || state !== storedState) {
    return res.redirect('/?error=invalid_state');
  }

  if (!codeVerifier) {
    return res.redirect('/?error=missing_verifier');
  }

  try {
    // Exchange the code for an access token
    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        code: code as string,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/twitter/callback`,
        code_verifier: codeVerifier,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Token response error:', tokenData);
      throw new Error('Failed to get access token');
    }

    // Clear the oauth cookies
    res.setHeader('Set-Cookie', [
      'oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
      'code_verifier=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
      // Set the new auth token
      `auth_token=${tokenData.access_token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`, // 7 days
    ]);

    // Redirect to the dashboard
    res.redirect('/');
  } catch (error) {
    console.error('Token exchange failed:', error);
    res.redirect('/?error=token_exchange_failed');
  }
} 