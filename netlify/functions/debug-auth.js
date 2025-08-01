const crypto = require('crypto');

function hashPassword(password) {
  return crypto.createHash('sha512').update(password).digest('hex');
}

// Test the password hashing
const testPassword = "admin123";
const hashedPassword = hashPassword(testPassword);

console.log("Password:", testPassword);
console.log("Generated Hash:", hashedPassword);
console.log("Expected Hash: c7ad44cbad762a5da0a452f9e854fdc1e0e7a52a38015f23f3eab1d80b931dd472634dfac71cd34ebc35d16ab7fb8a90c81f975113d6c7538dc69dd8de9077ec");
console.log("Hashes Match:", hashedPassword === "c7ad44cbad762a5da0a452f9e854fdc1e0e7a52a38015f23f3eab1d80b931dd472634dfac71cd34ebc35d16ab7fb8a90c81f975113d6c7538dc69dd8de9077ec");

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  try {
    // Debug information
    const body = JSON.parse(event.body || '{}');
    const { password } = body;
    
    if (password) {
      const inputHash = hashPassword(password);
      const expectedHash = process.env.ADMIN_PASSWORD_HASH || 'c7ad44cbad762a5da0a452f9e854fdc1e0e7a52a38015f23f3eab1d80b931dd472634dfac71cd34ebc35d16ab7fb8a90c81f975113d6c7538dc69dd8de9077ec';
      
      console.log("Debug Info:");
      console.log("Input password:", password);
      console.log("Input hash:", inputHash);
      console.log("Expected hash:", expectedHash);
      console.log("Environment variable set:", !!process.env.ADMIN_PASSWORD_HASH);
      console.log("Hashes match:", inputHash === expectedHash);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        debug: true,
        message: "Check server logs for debug information",
        environmentVariableSet: !!process.env.ADMIN_PASSWORD_HASH,
        inputPassword: password || "none provided",
        inputHash: password ? hashPassword(password) : "none",
        expectedHash: process.env.ADMIN_PASSWORD_HASH || "using default"
      })
    };

  } catch (error) {
    console.error('Debug error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Debug error', details: error.message })
    };
  }
};
