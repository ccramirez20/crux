import type { Gender } from './index';

export interface EligibilityCategory {
  gender: Gender | null;
  minAge: number | null;
  maxAge: number | null;
}

export function parseDateOnly(value: string): Date {
  const parts = value.split('-').map(Number);
  const year = parts[0]!;
  const month = parts[1]!;
  const day = parts[2]!;
  return new Date(year, month - 1, day);
}

export function ageInYears(birthDate: Date, today: Date): number {
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

// Sin fecha de nacimiento no hay cómo comprobar la mayoría de edad, y se trata
// como menor por seguridad — la misma indulgencia que `isEligible` pero al
// revés: ahí un dato incompleto deja pasar, aquí un dato incompleto bloquea.
export function isMinor(birthDate: string | null, today: Date = new Date()): boolean {
  if (!birthDate) return true;
  return ageInYears(parseDateOnly(birthDate), today) < 18;
}

export function isEligible(
  category: EligibilityCategory,
  birthDate: Date,
  gender: Gender,
  today: Date = new Date(),
): boolean {
  const genderMatches =
    category.gender === null || category.gender === 'mixed' || category.gender === gender;
  if (!genderMatches) {
    return false;
  }

  const age = ageInYears(birthDate, today);
  if (category.minAge !== null && age < category.minAge) {
    return false;
  }
  if (category.maxAge !== null && age > category.maxAge) {
    return false;
  }
  return true;
}
