/**
 * Client-side user identifier manager for history isolation.
 */
export function getOrCreateUserId(): string {
  if (typeof window === 'undefined') return '';
  
  let userId = localStorage.getItem('editorial_engine_user_id');
  if (!userId) {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      userId = crypto.randomUUID();
    } else {
      userId = 'user_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
    }
    localStorage.setItem('editorial_engine_user_id', userId);
  }
  return userId;
}
