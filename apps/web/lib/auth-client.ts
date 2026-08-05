import { createAuthClient } from 'better-auth/react';

// No baseURL — the organizer pages and the auth API route are served from the
// same Next.js origin, so Better Auth's client defaults to same-origin requests.
export const authClient = createAuthClient();
