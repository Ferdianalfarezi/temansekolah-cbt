import { CbtRole } from "@/common/enums";

/**
 * Maps LMS staff roles to CBT application roles.
 * Returns null for roles that have no access to the CBT system.
 */
const LMS_TO_CBT_ROLE: Record<string, CbtRole | null> = {
  super_admin: CbtRole.SUPERADMIN,
  admin: CbtRole.ADMIN_SEKOLAH,
  kepala_sekolah: CbtRole.ADMIN_SEKOLAH,
  guru: CbtRole.GURU,
  bendahara: null,
  orang_tua: null,
};

/**
 * Maps an LMS role string to a CBT role.
 * @returns The corresponding CbtRole, or null if the role has no CBT access.
 */
export function mapLmsRoleToCbt(lmsRole: string): CbtRole | null {
  return LMS_TO_CBT_ROLE[lmsRole] ?? null;
}
