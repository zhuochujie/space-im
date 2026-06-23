import { GroupMemberRole } from '@openim/rn-client-sdk';

export const groupMemberRoleText = (roleLevel: number) => {
  if (roleLevel === GroupMemberRole.Owner) {
    return '群主';
  }
  if (roleLevel === GroupMemberRole.Admin) {
    return '管理员';
  }
  return '普通成员';
};
