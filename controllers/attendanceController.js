const { validationResult } = require('express-validator');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const User = require('../models/User');

// @desc    Get all attendance records
// @route   GET /api/attendance
// @access  Private
const getAllAttendance = async (req, res) => {
  try {
    const { employee, startDate, endDate, status, page = 1, limit = 50 } = req.query;
    
    const query = {};
    
    if (employee) query.employee = employee;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        // Set to beginning of start date (00:00:00)
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        query.date.$gte = start;
      }
      if (endDate) {
        // Set to end of end date (23:59:59.999)
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const attendance = await Attendance.find(query)
      .populate('employee', 'name email designation') // Changed to User fields
      .populate('createdBy', 'name')
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Transform attendance records to add firstName/lastName from User's name field
    const transformedAttendance = attendance.map(record => {
      if (record.employee && record.employee.name) {
        const nameParts = record.employee.name.trim().split(' ');
        const firstName = nameParts[0] || record.employee.name;
        const lastName = nameParts.slice(1).join(' ') || '';
        
        return {
          ...record.toObject(),
          employee: {
            ...record.employee.toObject(),
            firstName,
            lastName,
            employeeId: `USER${record.employee._id.toString().slice(-8).toUpperCase()}`
          }
        };
      }
      return record.toObject();
    });
    
    const total = await Attendance.countDocuments(query);
    
    res.json({
      success: true,
      count: attendance.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      attendance: transformedAttendance
    });
  } catch (error) {
    console.error('❌ Get all attendance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get attendance by employee
// @route   GET /api/attendance/employee/:employeeId
// @access  Private
const getAttendanceByEmployee = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const query = { employee: req.params.employeeId };
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    
    const attendance = await Attendance.find(query)
      .sort({ date: -1 })
      .populate('employee', 'name email designation'); // Changed to User fields
    
    // Transform attendance records
    const transformedAttendance = attendance.map(record => {
      if (record.employee && record.employee.name) {
        const nameParts = record.employee.name.trim().split(' ');
        const firstName = nameParts[0] || record.employee.name;
        const lastName = nameParts.slice(1).join(' ') || '';
        
        return {
          ...record.toObject(),
          employee: {
            ...record.employee.toObject(),
            firstName,
            lastName,
            employeeId: `USER${record.employee._id.toString().slice(-8).toUpperCase()}`
          }
        };
      }
      return record.toObject();
    });
    
    // Calculate statistics
    const stats = {
      totalDays: transformedAttendance.length,
      present: transformedAttendance.filter(a => a.status === 'Present').length,
      absent: transformedAttendance.filter(a => a.status === 'Absent').length,
      halfDay: transformedAttendance.filter(a => a.status === 'Half Day').length,
      onLeave: transformedAttendance.filter(a => a.status === 'On Leave').length,
      totalWorkHours: transformedAttendance.reduce((sum, a) => sum + (a.workHours || 0), 0)
    };
    
    res.json({
      success: true,
      count: transformedAttendance.length,
      stats,
      attendance: transformedAttendance
    });
  } catch (error) {
    console.error('❌ Get attendance by employee error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create attendance record (Check-in)
// @route   POST /api/attendance
// @access  Private
const createAttendance = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { employee, date, checkIn, checkOut, status, notes, location } = req.body;
    
    // Verify user exists
    const userDoc = await User.findById(employee);
    if (!userDoc) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if attendance already exists for this employee and date
    const dateObj = new Date(date);
    dateObj.setHours(0, 0, 0, 0);
    
    const existingAttendance = await Attendance.findOne({
      employee,
      date: dateObj
    });
    
    if (existingAttendance) {
      return res.status(400).json({ message: 'Attendance already recorded for this date' });
    }
    
    const attendance = new Attendance({
      employee,
      date: dateObj,
      checkIn: checkIn || new Date(),
      checkOut: checkOut || null,
      status: status || 'Present',
      notes,
      location: location ? { checkIn: location } : undefined,
      createdBy: req.user._id
    });
    
    await attendance.save();
    await attendance.populate('employee', 'name email designation');
    
    // Transform the response
    let transformedAttendance = attendance.toObject();
    if (attendance.employee && attendance.employee.name) {
      const nameParts = attendance.employee.name.trim().split(' ');
      const firstName = nameParts[0] || attendance.employee.name;
      const lastName = nameParts.slice(1).join(' ') || '';
      
      transformedAttendance.employee = {
        ...attendance.employee.toObject(),
        firstName,
        lastName,
        employeeId: `USER${attendance.employee._id.toString().slice(-8).toUpperCase()}`
      };
    }
    
    res.status(201).json({
      success: true,
      message: 'Attendance recorded successfully',
      attendance: transformedAttendance
    });
  } catch (error) {
    console.error('❌ Create attendance error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Attendance already exists for this employee and date' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update attendance (Check-out)
// @route   PUT /api/attendance/:id
// @access  Private
const updateAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id);
    
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }
    
    // Update fields
    if (req.body.checkIn) attendance.checkIn = req.body.checkIn;
    if (req.body.checkOut) {
      attendance.checkOut = req.body.checkOut;
      if (req.body.location) {
        attendance.location = {
          ...attendance.location,
          checkOut: req.body.location
        };
      }
    }
    
    if (req.body.status) attendance.status = req.body.status;
    if (req.body.notes !== undefined) attendance.notes = req.body.notes;
    
    await attendance.save();
    await attendance.populate('employee', 'name email designation');
    
    // Transform the response
    let transformedAttendance = attendance.toObject();
    if (attendance.employee && attendance.employee.name) {
      const nameParts = attendance.employee.name.trim().split(' ');
      const firstName = nameParts[0] || attendance.employee.name;
      const lastName = nameParts.slice(1).join(' ') || '';
      
      transformedAttendance.employee = {
        ...attendance.employee.toObject(),
        firstName,
        lastName,
        employeeId: `USER${attendance.employee._id.toString().slice(-8).toUpperCase()}`
      };
    }
    
    res.json({
      success: true,
      message: 'Attendance updated successfully',
      attendance: transformedAttendance
    });
  } catch (error) {
    console.error('❌ Update attendance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete attendance record
// @route   DELETE /api/attendance/:id
// @access  Private/Admin
const deleteAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id);
    
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }
    
    await Attendance.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Attendance record deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete attendance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get attendance statistics
// @desc    Get attendance statistics
// @route   GET /api/attendance/stats/overview
// @access  Private
const getAttendanceStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const query = {};
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        // Set to beginning of start date (00:00:00)
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        query.date.$gte = start;
      }
      if (endDate) {
        // Set to end of end date (23:59:59.999)
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }
    
    const totalRecords = await Attendance.countDocuments(query);
    const presentCount = await Attendance.countDocuments({ ...query, status: 'Present' });
    const absentCount = await Attendance.countDocuments({ ...query, status: 'Absent' });
    const halfDayCount = await Attendance.countDocuments({ ...query, status: 'Half Day' });
    const onLeaveCount = await Attendance.countDocuments({ ...query, status: 'On Leave' });
    
    // Calculate average work hours
    const avgWorkHours = await Attendance.aggregate([
      { $match: query },
      { $group: { _id: null, avgHours: { $avg: '$workHours' } } }
    ]);
    
    res.json({
      success: true,
      stats: {
        totalRecords,
        presentCount,
        absentCount,
        halfDayCount,
        onLeaveCount,
        averageWorkHours: avgWorkHours.length > 0 ? Math.round(avgWorkHours[0].avgHours * 100) / 100 : 0
      }
    });
  } catch (error) {
    console.error('❌ Get attendance stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Bulk create attendance
// @route   POST /api/attendance/bulk
// @access  Private/Admin
const bulkCreateAttendance = async (req, res) => {
  try {
    const { date, employees } = req.body;
    
    if (!employees || !Array.isArray(employees) || employees.length === 0) {
      return res.status(400).json({ message: 'Employees array is required' });
    }
    
    const dateObj = new Date(date);
    dateObj.setHours(0, 0, 0, 0);
    
    const attendanceRecords = employees.map(emp => ({
      employee: emp.employeeId,
      date: dateObj,
      status: emp.status || 'Present',
      checkIn: emp.checkIn || new Date(),
      checkOut: emp.checkOut,
      notes: emp.notes,
      createdBy: req.user._id
    }));
    
    const result = await Attendance.insertMany(attendanceRecords, { ordered: false });
    
    res.status(201).json({
      success: true,
      message: `${result.length} attendance records created successfully`,
      count: result.length
    });
  } catch (error) {
    console.error('❌ Bulk create attendance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getAllAttendance,
  getAttendanceByEmployee,
  createAttendance,
  updateAttendance,
  deleteAttendance,
  getAttendanceStats,
  bulkCreateAttendance
};
