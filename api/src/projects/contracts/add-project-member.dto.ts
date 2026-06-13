import { z } from 'zod';

import { ProjectRole } from '../entities/project-role.enum';

export const assignableProjectMemberRoles = [
  ProjectRole.MAINTAINER,
  ProjectRole.DEVELOPER
] as const;

export const addProjectMemberSchema = z.strictObject({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  role: z.enum(assignableProjectMemberRoles)
});

export type AddProjectMemberDto = z.infer<typeof addProjectMemberSchema>;
