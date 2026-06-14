const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Changed from 'Employee' to 'User' to support user-based attendance
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  checkIn: {
    type: Date,
    default: null
  },
  checkOut: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['Present', 'Absent', 'Half Day', 'On Leave', 'Holiday', 'Weekend'],
    default: 'Absent'
  },
  workHours: {
    type: Number,
    default: 0,
    min: 0
  },
  notes: {
    type: String,
    trim: true
  },
  location: {
    checkIn: {
      latitude: Number,
      longitude: Number
    },
    checkOut: {
      latitude: Number,
      longitude: Number
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  collection: 'attendance'
});

// Compound index to ensure one attendance record per employee per day
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: -1 });
attendanceSchema.index({ status: 1 });

// Calculate work hours before saving
attendanceSchema.pre('save', function(next) {
  if (this.checkIn && this.checkOut) {
    const hours = (this.checkOut - this.checkIn) / (1000 * 60 * 60);
    this.workHours = Math.round(hours * 100) / 100; // Round to 2 decimal places
    
    // Auto-set status based on work hours
    if (this.workHours >= 8) {
      this.status = 'Present';
    } else if (this.workHours >= 4) {
      this.status = 'Half Day';
    }
  }
  next();
});

module.exports = mongoose.model('Attendance', attendanceSchema);
