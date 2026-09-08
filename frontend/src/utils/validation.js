const NAME_REGEX = /^[A-Za-z]+(?:['’-][A-Za-z]+)*(?:\.)?(?:\s(?:[A-Za-z]+(?:['’-][A-Za-z]+)*\.?))*$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

export const validateName = (name) => {
  if (!name || typeof name !== 'string' || !name.trim()) {
    return 'Please provide a name';
  }
  if (name.trim().length > 50) {
    return 'Name cannot exceed 50 characters';
  }
  if (!NAME_REGEX.test(name.trim())) {
    return 'Name can only contain letters, spaces, hyphens, apostrophes, and periods';
  }
  return null;
};

export const validatePassword = (password) => {
  if (!password || typeof password !== 'string') {
    return 'Please provide a password';
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (!PASSWORD_REGEX.test(password)) {
    return 'Password must include at least one uppercase letter, one lowercase letter, one number, and one special character';
  }
  return null;
};
