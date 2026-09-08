// Escape user-supplied strings before use in a RegExp, preventing
// regex metacharacters from throwing or altering the match pattern.
const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { escapeRegExp };
