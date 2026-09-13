import {
  INACTIVE_ACCOUNT_MESSAGE,
  INACTIVE_TEACHER_MESSAGE,
  inactiveAccountMessage,
  isActiveOnRegistration,
  requiresActivation,
} from '../../../../src/domain/policies/account-activation.policy.js';
import { ROLES } from '../../../../src/domain/constants/roles.constant.js';

describe('account activation policy', () => {
  it('students are active on registration, teachers are not', () => {
    expect(isActiveOnRegistration(ROLES.STUDENT)).toBe(true);
    expect(isActiveOnRegistration(ROLES.TEACHER)).toBe(false);
  });

  it('only teacher accounts require activation', () => {
    expect(requiresActivation(ROLES.TEACHER)).toBe(true);
    expect(requiresActivation(ROLES.STUDENT)).toBe(false);
    expect(requiresActivation(ROLES.ADMIN)).toBe(false);
    expect(requiresActivation(null)).toBe(false);
  });

  it('inactive, non-deleted teachers get the pending approval message', () => {
    expect(INACTIVE_TEACHER_MESSAGE).toBe(
      'Account is inactive. Your teacher account is pending administrator approval.',
    );
    expect(inactiveAccountMessage({ roleId: ROLES.TEACHER, deletedAt: null })).toBe(INACTIVE_TEACHER_MESSAGE);
  });

  it('any other inactive account gets a generic message with the same prefix', () => {
    expect(INACTIVE_ACCOUNT_MESSAGE.startsWith('Account is inactive')).toBe(true);
    expect(inactiveAccountMessage({ roleId: ROLES.TEACHER, deletedAt: new Date() })).toBe(INACTIVE_ACCOUNT_MESSAGE);
    expect(inactiveAccountMessage({ roleId: ROLES.STUDENT, deletedAt: null })).toBe(INACTIVE_ACCOUNT_MESSAGE);
  });
});
