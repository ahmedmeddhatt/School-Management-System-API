const mongoose         = require('mongoose');
const bcrypt           = require('bcryptjs');
const softDeletePlugin = require('../libs/softDelete.plugin');

const apiKeySchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true },
    keyHash:  { type: String, required: true },          // SHA-256 of raw key
    lastUsed: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const userSchema = new mongoose.Schema(
  {
    email:    { type: String, required: true, trim: true, lowercase: true },
    password: { type: String, required: true, select: false },
    role:     { type: String, enum: ['SUPER_ADMIN', 'SCHOOL_ADMIN'], required: true },
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', default: null },

    // MFA
    mfaEnabled: { type: Boolean, default: false },
    mfaSecret:  { type: String, select: false, default: null }, // TOTP secret (store encrypted in prod)

    // API Keys
    apiKeys: { type: [apiKeySchema], default: [] },
  },
  { timestamps: true }
);

userSchema.plugin(softDeletePlugin);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ 'apiKeys.keyHash': 1 });

// Hash password before save
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', userSchema);
