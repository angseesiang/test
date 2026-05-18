export async function auditLog(action: string, entityType: string, metadata: Record<string, unknown>) {
  // Persist with Prisma in real implementation.
  console.log(JSON.stringify({ action, entityType, metadata, at: new Date().toISOString() }));
}
