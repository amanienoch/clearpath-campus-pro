export const MIN_PASSWORD_LENGTH = 6;

export function isPasswordLongEnough(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}

export function passwordsMatch(password: string, confirmation: string): boolean {
  return password === confirmation;
}
