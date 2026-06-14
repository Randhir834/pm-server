const mongoose = require('mongoose');

const salarySchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  month: {
    type: Date,
    required: true
  },
  basicSalary: {
    type: Number,
    required: true,
    min: 0
  },
  allowances: {
    type: Number,
    default: 0,
    min: 0
  },
  deductions: {
    type: Number,
    default: 0,
    min: 0
  },
  bonus: {
    type: Number,
    default: 0,
    min: 0
  },
  totalSalary: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'cancelled'],
    default: 'pending'
  },
  paidDate: {
    type: Date
  },
  notes: {
    type: String
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate salary entries for same employee and month
salarySchema.index({ employeeId: 1, month: 1 }, { unique: true });

// Virtual for per-day wage
salarySchema.virtual('perDayWage').get(function() {
  return (this.totalSalary / 30).toFixed(2);
});

// Ensure virtuals are included in JSON
salarySchema.set('toJSON', { virtuals: true });
salarySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Salary', salarySchema);
