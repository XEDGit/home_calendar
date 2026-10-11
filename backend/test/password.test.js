import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newPasswordProblem, issuedAfterChange, MIN_LENGTH, MAX_LENGTH } from '../password.js';

test('a new password needs at least MIN_LENGTH characters', () => {
	assert.equal(MIN_LENGTH, 8);
	assert.match(newPasswordProblem('old-secret', 'short'), /at least 8/);
	assert.match(newPasswordProblem('old-secret', ''), /at least 8/);
	assert.equal(newPasswordProblem('old-secret', 'eight888'), null);
});

test('a new password is at most MAX_LENGTH characters', () => {
	assert.equal(newPasswordProblem('old-secret', 'x'.repeat(MAX_LENGTH)), null);
	assert.match(newPasswordProblem('old-secret', 'x'.repeat(MAX_LENGTH + 1)), /at most/);
});

test('a new password must differ from the current one', () => {
	assert.match(newPasswordProblem('same-password', 'same-password'), /same/);
});

test('anything but a string is refused', () => {
	assert.ok(newPasswordProblem('old-secret', undefined));
	assert.ok(newPasswordProblem('old-secret', 12345678));
	assert.ok(newPasswordProblem('old-secret', { $ne: null }));
});

test('without a password change every login counts', () => {
	assert.equal(issuedAfterChange(1700000000, undefined), true);
	assert.equal(issuedAfterChange(1700000000, null), true);
});

test('logins issued before the change stop counting; the same second and later still count', () => {
	const changedAt = 1800000000;
	assert.equal(issuedAfterChange(changedAt - 1, changedAt), false);
	assert.equal(issuedAfterChange(changedAt, changedAt), true);
	assert.equal(issuedAfterChange(changedAt + 60, changedAt), true);
});

test('a login without an issue time does not count once the password has changed', () => {
	assert.equal(issuedAfterChange(undefined, 1800000000), false);
	assert.equal(issuedAfterChange('soon', 1800000000), false);
});
