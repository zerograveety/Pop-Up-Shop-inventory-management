const bcrypt = require('bcrypt');
const pool = require('./db');

async function fixUserPasswords() {
  try {
    console.log('Checking and fixing user passwords...\n');
    
    // Get all users
    const result = await pool.query('SELECT * FROM users ORDER BY user_id');
    
    for (const user of result.rows) {
      console.log(`\nProcessing user: ${user.name} (${user.email})`);
      console.log(`Current password_hash: ${user.password_hash}`);
      
      // Check if it's already a bcrypt hash
      const isBcryptHash = user.password_hash.startsWith('$2b$') || user.password_hash.startsWith('$2a$');
      
      if (!isBcryptHash) {
        console.log('  -> Password appears to be plain text. Hashing it...');
        
        // Hash the plain text password
        const hashedPassword = await bcrypt.hash(user.password_hash, 12);
        
        // Update in database
        await pool.query(
          'UPDATE users SET password_hash = $1 WHERE user_id = $2',
          [hashedPassword, user.user_id]
        );
        
        console.log('  -> Password updated successfully!');
      } else {
        console.log('  -> Password is already properly hashed.');
      }
    }
    
    console.log('\n✅ All passwords have been processed!');
    console.log('\nYou can now login with:');
    console.log('- harsh@popup.com / hashedpass1');
    console.log('- bhavesh@popup.com / hashedpass2'); 
    console.log('- mangesh@popup.com / hashedpass3');
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

fixUserPasswords();