import { Matches } from 'class-validator';

/** "gaya.kulit.rambut.latar.baju.kacamata" — samakan dengan SPEC_RE di apps/frontend/src/lib/avatars.ts. */
export const AVATAR_SPEC_RE = /^([0-9]|1[01])\.([0-4])\.([0-4])\.([0-5])\.([0-5])\.([01])$/;

export class SetAvatarDto {
  @Matches(AVATAR_SPEC_RE)
  avatar: string;
}
