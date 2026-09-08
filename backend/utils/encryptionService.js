const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

// Generate a random encryption key
const generateKey = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Encrypt a file buffer
const encryptBuffer = (buffer, key) => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(key, 'hex'),
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(buffer),
    cipher.final()
  ]);

  // Prepend IV to encrypted data
  return Buffer.concat([iv, encrypted]);
};

// Decrypt a file buffer
const decryptBuffer = (buffer, key) => {
  // Extract IV from the beginning of the buffer
  const iv = buffer.slice(0, IV_LENGTH);
  const encryptedData = buffer.slice(IV_LENGTH);

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(key, 'hex'),
    iv
  );

  return Buffer.concat([
    decipher.update(encryptedData),
    decipher.final()
  ]);
};

// Encrypt a string value (for sensitive metadata)
const encryptString = (text, key) => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(key, 'hex'),
    iv
  );

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return `${iv.toString('hex')}:${encrypted}`;
};

// Decrypt a string value
const decryptString = (encryptedText, key) => {
  const [ivHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(key, 'hex'),
    iv
  );

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
};

// Hash a value using SHA-256 (for file integrity checks)
const hashFile = (buffer) => {
  return crypto.createHash('sha256').update(buffer).digest('hex');
};

module.exports = {
  generateKey,
  encryptBuffer,
  decryptBuffer,
  encryptString,
  decryptString,
  hashFile
};