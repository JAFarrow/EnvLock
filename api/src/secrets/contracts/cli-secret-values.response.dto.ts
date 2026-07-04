export interface CliSecretValuesResponseDto {
  projectId: string;
  environmentId: string;
  environment: string;
  variables: Record<string, string>;
}
