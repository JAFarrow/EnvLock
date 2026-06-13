import { z } from 'zod';

import { assignableProjectMemberRoles } from './add-project-member.dto';

export const updateProjectMemberRoleSchema = z.strictObject({
  role: z.enum(assignableProjectMemberRoles)
});

export type UpdateProjectMemberRoleDto = z.infer<typeof updateProjectMemberRoleSchema>;
