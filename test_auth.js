const connectDB = require('./config/db');
const User = require('./models/User');

const testLogin = async () => {
  await connectDB();
  const email = 'senior@safereach.com';
  const pass = 'password123';

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  console.log('User found in DB:', user ? user.email : 'NOT FOUND');
  if (user) {
    console.log('User password hash in DB:', user.password);
    const isMatch = await user.matchPassword(pass);
    console.log('Password match test:', isMatch);
  }
  process.exit(0);
};

testLogin();
