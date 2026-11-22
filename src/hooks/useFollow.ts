import { useEffect, useState } from 'react';
import { getInbox, isFollowing, subscribe, unreadCount } from '../lib/follow';

/** Re-renderiza cuando cambian los seguidos o la bandeja de avisos. */
export function useFollowStore() {
  const [, force] = useState(0);
  useEffect(() => subscribe(() => force((n) => n + 1)), []);
  return { isFollowing, inbox: getInbox(), unread: unreadCount() };
}
