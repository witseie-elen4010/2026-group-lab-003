const bcrypt = require('bcrypt')

console.log('STARTING AUTHENTICATION PIPELINE TEST')
console.log('-----------------------------------------')

try {
  // TEST 1: Library Integrity
  console.log('1. Testing library loading...')
  if (typeof bcrypt.compareSync === 'function') {
    console.log('SUCCESS: Bcrypt is loaded correctly.')
  }

  // TEST 2: Hashing Logic (Simulation of Registration)
  console.log('\n2. Simulating Registration (Hashing)...')
  const plainPassword = 'MySecretPassword123'
  const salt = bcrypt.genSaltSync(10)
  const mockHashFromDb = bcrypt.hashSync(plainPassword, salt)
  console.log('SUCCESS: Hash created:', mockHashFromDb)

  // TEST 3: Object Simulation (Testing your "user.password" theory)
  console.log('\n3. Simulating Mongoose Object behavior...')
  const mockUser = {
    email: 'test@example.com',
    password: mockHashFromDb // This mimics your 'user.password'
  }

  if (mockUser.password) {
    console.log('SUCCESS: Mock user object created with password.')
  }

  // TEST 4: The Comparison (The part where you keep stopping)
  console.log('\n4. Attempting final comparison...')
  const isMatch = bcrypt.compareSync(plainPassword, mockUser.password)

  if (isMatch) {
    console.log('SUCCESS: Comparison returned TRUE. Logic is perfect.')
  } else {
    console.log('FAIL: Comparison returned FALSE. Check salt/hash.')
  }

  // TEST 5: Data Type Check
  console.log('\n5. Checking for data type issues...')
  console.log('Type of input:', typeof plainPassword)
  console.log('Type of hash:', typeof mockUser.password)
} catch (err) {
  console.log('\n CRITICAL FAILURE DETECTED:')
  console.error('Error Name:', err.name)
  console.error('Error Message:', err.message)
  console.error('Stack Trace:', err.stack)
}

console.log('\n-----------------------------------------')
console.log('TEST FINISHED')
