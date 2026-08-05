const AUTH_ERROR_MESSAGES: Record<string, string> = {
  PASSWORD_TOO_SHORT: 'La contraseña es muy corta (mínimo 8 caracteres).',
  PASSWORD_TOO_LONG: 'La contraseña es muy larga (máximo 128 caracteres).',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'Ese correo ya está registrado, intenta iniciar sesión.',
  INVALID_EMAIL_OR_PASSWORD: 'Correo o contraseña incorrectos.',
  INVALID_EMAIL: 'Ese correo no es válido.',
};

export function translateAuthError(code: string | undefined, fallback: string): string {
  return (code && AUTH_ERROR_MESSAGES[code]) || fallback;
}
