const crypto = require('crypto');

function hashPassword(password) {
  return crypto.createHash('sha512').update(password).digest('hex');
}

exports.handler = async (event, context) => {
  const { ADMIN_PASSWORD_HASH } = process.env;
  
  // Test password hashes
  const testPassword = 'admin123';
  const computedHash = hashPassword(testPassword);
  const defaultHash = '7fcf4ba391c48784edde599889d6e3f1e47a27db36ecc050cc92f259bfac38afad2c68a1ae804d77075e8fb722503f3eca2b2c1006ee6f6c7b7628cb45fffd1d';
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      message: 'Password hash debug information',
      testPassword: testPassword,
      computedHash: computedHash,
      storedHash: ADMIN_PASSWORD_HASH || 'NOT_SET',
      defaultHash: defaultHash,
      hashesMatch: (ADMIN_PASSWORD_HASH || defaultHash) === computedHash,
      usingDefault: !ADMIN_PASSWORD_HASH
    })
  };
};