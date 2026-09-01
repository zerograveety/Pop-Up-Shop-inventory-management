const bcrypt = require('bcrypt');
const pool = require('./db');

async function fixUserPasswords() {
  try {
    console.log('Checking and fixing user passwords...\n');

    const result = await pool.query('SELECT * FROM users ORDER BY id');

    for (const user of result.rows) {
      console.log(`\nProcessing user: ${user.name} (${user.email})`);
      const stored = user.password || '';
      const isBcryptHash = typeof stored === 'string' && (stored.startsWith('$2b$') || stored.startsWith('$2a$'));

      if (!isBcryptHash) {
        console.log('  -> Password appears to be plain text. Hashing it...');
        const hashedPassword = await bcrypt.hash(stored, 12);
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, user.id]);
        console.log('  -> Password updated successfully!');
      } else {
        console.log('  -> Password is already properly hashed.');
      }
    }

    console.log('\nAll passwords have been processed!');
  } catch (error) {
    console.error('Error:', error);
  }

  process.exit(0);
}

fixUserPasswords();
