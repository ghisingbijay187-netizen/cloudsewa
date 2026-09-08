// Name: letters, spaces, hyphens, apostrophes, periods (e.g. "Mary-Jane O'Brien",
// "Dr. Arpana Jirel", "Dr. A. Jirel")
const NAME_REGEX = /^[A-Za-z]+(?:['’-][A-Za-z]+)*(?:\.)?(?:\s(?:[A-Za-z]+(?:['’-][A-Za-z]+)*\.?))*$/;
// At least one lowercase, one uppercase, one digit, one special character
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

const validateName = (name) => {
  if (!name || typeof name !== 'string') {
    return 'Please provide a name';
  }
  const trimmed = name.trim();
  if (!trimmed) {
    return 'Please provide a name';
  }
  if (trimmed.length > 50) {
    return 'Name cannot exceed 50 characters';
  }
  if (!NAME_REGEX.test(trimmed)) {
    return 'Name can only contain letters, spaces, hyphens, apostrophes, and periods';
  }
  return null;
};

const validatePassword = (password) => {
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

module.exports = { validateName, validatePassword };
