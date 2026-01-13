/**
 * HTTP Basic Auth Middleware for Vercel Edge
 *
 * Protects the entire OHIF Viewer with username/password authentication.
 * Credentials are stored in Vercel Environment Variables:
 * - BASIC_AUTH_USER
 * - BASIC_AUTH_PASSWORD
 */

export const config = {
  matcher: '/(.*)',
};

export default function middleware(request: Request): Response | undefined {
  const authHeader = request.headers.get('authorization');

  // Get credentials from environment variables
  const expectedUser = process.env.BASIC_AUTH_USER;
  const expectedPassword = process.env.BASIC_AUTH_PASSWORD;

  // If no credentials are configured, skip auth (for local development)
  if (!expectedUser || !expectedPassword) {
    return undefined; // Continue to the app
  }

  // Check if Authorization header is present
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return unauthorizedResponse();
  }

  // Decode and validate credentials
  try {
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = atob(base64Credentials);
    const [username, password] = credentials.split(':');

    if (username === expectedUser && password === expectedPassword) {
      return undefined; // Continue to the app
    }
  } catch {
    // Invalid base64 or format
  }

  return unauthorizedResponse();
}

/**
 * Returns a 401 Unauthorized response with WWW-Authenticate header.
 * This triggers the browser's native login dialog.
 */
function unauthorizedResponse(): Response {
  return new Response('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="OHIF Viewer", charset="UTF-8"',
    },
  });
}
