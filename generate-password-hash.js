const crypto = require('crypto');

function hashPassword(password) {
  return crypto.createHash('sha512').update(password).digest('hex');
}

// Test passwords
const passwords = ['admin123', 'Admin123', 'ADMIN123'];

console.log('🔒 Password Hash Generator');
console.log('==========================');

passwords.forEach(password => {
  const hash = hashPassword(password);
  console.log(`Password: "${password}"`);
  console.log(`Hash: ${hash}`);
  console.log(`Length: ${hash.length} characters`);
  console.log('---');
});

// Interactive mode
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n📝 Generate hash for custom password:');
rl.question('Enter your password (or press Enter to skip): ', (answer) => {
  if (answer.trim()) {
    const customHash = hashPassword(answer.trim());
    console.log('\n✅ Your custom password hash:');
    console.log(customHash);
    console.log('\n📋 Copy this hash to your Netlify environment variable ADMIN_PASSWORD_HASH');
  }
  rl.close();
});
