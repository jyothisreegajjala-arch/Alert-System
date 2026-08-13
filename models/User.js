const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ['senior_citizen', 'child', 'family_member', 'neighbor', 'security_guard', 'volunteer', 'admin'],
      default: 'senior_citizen'
    },
    address: { type: String, default: 'Springboard Community' },
    apartmentNumber: { type: String, default: 'A-101' },
    latitude: { type: Number, default: 12.9716 },
    longitude: { type: Number, default: 77.5946 },
    medicalInfo: { type: String, default: '' },
    active: { type: Boolean, default: true },
    dutyStatus: { type: String, default: 'ON_DUTY' },
    availability: { type: String, default: 'AVAILABLE' },
    familyContactName: { type: String, default: '' },
    familyPhone: { type: String, default: '' },
    familyRelationship: { type: String, default: '' },
    neighborName: { type: String, default: '' },
    neighborPhone: { type: String, default: '' },
    neighborApartment: { type: String, default: '' },
    guardName: { type: String, default: '' },
    guardPhone: { type: String, default: '' },
    volunteerName: { type: String, default: '' },
    volunteerPhone: { type: String, default: '' },
    emergencyContactName: { type: String, default: '' },
    emergencyContactPhone: { type: String, default: '' },
    emergencyContactRelationship: { type: String, default: '' }
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
