// The household password: what a new one must look like, and which logins
// still count after it changes. A change stamps the household with
// `passwordChangedAt` (seconds); /verify then refuses every login (JWT)
// issued before it, so other devices have to log in again.
export const MIN_LENGTH = 8;
export const MAX_LENGTH = 1024; // the same cap /login accepts

/** Why `next` can't be the new password, or null when it can. */
export function newPasswordProblem(current, next) {
	if (typeof next !== 'string' || next.length < MIN_LENGTH) return `Use at least ${MIN_LENGTH} characters`;
	if (next.length > MAX_LENGTH) return `Use at most ${MAX_LENGTH} characters`;
	if (next === current) return 'That is the same as the current password';
	return null;
}

/**
 * Whether a login issued at `iat` (JWT seconds) still counts, given the
 * household's last password change (seconds; absent when it never changed).
 * The new login handed out with a change is issued in that same second or
 * later, so it counts.
 */
export function issuedAfterChange(iat, changedAt) {
	if (changedAt == null) return true;
	return Number.isFinite(iat) && iat >= changedAt;
}
