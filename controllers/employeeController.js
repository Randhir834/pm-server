const { validationResult } = require('express-validator');
const Employee = require('../models/Employee');
const Department = require('../models/Department');

// Generate unique employee ID
const generateEmployeeId = async () => {
  const year = new Date().getFullYear();
  const count = await Employee.countDocuments({});
  return `EMP${year}${String(count + 1).padStart(4, '0')}`;
};

// @desc    Get all employees
// @route   GET /api/employees
// @access  Private
const getAllEmployees = async (req, res) => {
  try {
    const { department, status, search, page = 1, limit = 50 } = req.query;
    
    // Import User model to fetch all registered users
    const User = require('../models/User');
    
    // Fetch all registered users
    const users = await User.find({ isActive: true }).select('name email createdAt role');
    
    // Transform users into employee-like format
    const usersAsEmployees = users.map(user => {
      // Split name into first and last name
      const nameParts = user.name.trim().split(' ');
      const firstName = nameParts[0] || user.name;
      const lastName = nameParts.slice(1).join(' ') || '';
      
      return {
        _id: user._id,
        employeeId: `USER${user._id.toString().slice(-8).toUpperCase()}`, // Generate ID from user ID
        firstName: firstName,
        lastName: lastName,
        email: user.email,
        phone: 'N/A',
        dateOfBirth: null,
        gender: 'N/A',
        department: 'General',
        position: user.role === 'admin' ? 'Administrator' : 'User',
        joiningDate: user.createdAt,
        employmentType: 'Full-time',
        salary: 0,
        status: 'Active',
        source: 'user', // Flag to indicate this came from User collection
        createdAt: user.createdAt,
        updatedAt: user.createdAt
      };
    });
    
    // Fetch employees from Employee collection
    const query = {};
    
    if (department && department !== 'General') query.department = department;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } }
      ];
    }
    
    const employees = await Employee.find(query)
      .populate('manager', 'firstName lastName employeeId')
      .sort({ createdAt: -1 });
    
    // Mark employees from Employee collection
    const employeesWithSource = employees.map(emp => ({
      ...emp.toObject(),
      source: 'employee'
    }));
    
    // Combine users and employees, removing duplicates based on email
    const emailSet = new Set(employeesWithSource.map(e => e.email));
    const uniqueUsersAsEmployees = usersAsEmployees.filter(u => !emailSet.has(u.email));
    
    // Merge both lists
    let allEmployees = [...employeesWithSource, ...uniqueUsersAsEmployees];
    
    // Apply search filter to the combined list if search query exists
    if (search) {
      const searchLower = search.toLowerCase();
      allEmployees = allEmployees.filter(emp => 
        emp.firstName.toLowerCase().includes(searchLower) ||
        emp.lastName.toLowerCase().includes(searchLower) ||
        emp.email.toLowerCase().includes(searchLower) ||
        emp.employeeId.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply department filter to combined list
    if (department) {
      allEmployees = allEmployees.filter(emp => emp.department === department);
    }
    
    // Apply status filter to combined list
    if (status) {
      allEmployees = allEmployees.filter(emp => emp.status === status);
    }
    
    // Sort by creation date (newest first)
    allEmployees.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Calculate pagination
    const total = allEmployees.length;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedEmployees = allEmployees.slice(skip, skip + parseInt(limit));
    
    res.json({
      success: true,
      count: paginatedEmployees.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      employees: paginatedEmployees
    });
  } catch (error) {
    console.error('❌ Get all employees error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get employee by ID
// @route   GET /api/employees/:id
// @access  Private
const getEmployeeById = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id)
      .populate('manager', 'firstName lastName employeeId position')
      .populate('createdBy', 'name email');
    
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    
    res.json({
      success: true,
      employee
    });
  } catch (error) {
    console.error('❌ Get employee by ID error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create new employee
// @route   POST /api/employees
// @access  Private
const createEmployee = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { email, phone } = req.body;
    
    // Check if employee with email already exists
    const existingEmployee = await Employee.findOne({ email });
    if (existingEmployee) {
      return res.status(400).json({ message: 'Employee with this email already exists' });
    }
    
    // Generate employee ID
    const employeeId = await generateEmployeeId();
    
    const employee = new Employee({
      ...req.body,
      employeeId,
      createdBy: req.user._id
    });
    
    await employee.save();
    
    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      employee
    });
  } catch (error) {
    console.error('❌ Create employee error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update employee
// @route   PUT /api/employees/:id
// @access  Private
const updateEmployee = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const employee = await Employee.findById(req.params.id);
    
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    
    // If email is being updated, check for duplicates
    if (req.body.email && req.body.email !== employee.email) {
      const existingEmployee = await Employee.findOne({ email: req.body.email });
      if (existingEmployee) {
        return res.status(400).json({ message: 'Employee with this email already exists' });
      }
    }
    
    // Update employee
    Object.keys(req.body).forEach(key => {
      if (key !== 'employeeId' && key !== 'createdBy') {
        employee[key] = req.body[key];
      }
    });
    
    await employee.save();
    
    await employee.populate('manager', 'firstName lastName employeeId');
    
    res.json({
      success: true,
      message: 'Employee updated successfully',
      employee
    });
  } catch (error) {
    console.error('❌ Update employee error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete employee
// @route   DELETE /api/employees/:id
// @access  Private/Admin
const deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    
    await Employee.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Employee deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete employee error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get employee statistics
// @route   GET /api/employees/stats/overview
// @access  Private
const getEmployeeStats = async (req, res) => {
  try {
    // Import User model
    const User = require('../models/User');
    
    // Get counts from Employee collection
    const employeesTotal = await Employee.countDocuments({});
    const employeesActive = await Employee.countDocuments({ status: 'Active' });
    const employeesOnLeave = await Employee.countDocuments({ status: 'On Leave' });
    
    // Get counts from User collection
    const usersTotal = await User.countDocuments({ isActive: true });
    
    // Get emails of employees to avoid counting duplicates
    const employeeEmails = await Employee.find({}).distinct('email');
    const uniqueUsersCount = await User.countDocuments({ 
      isActive: true, 
      email: { $nin: employeeEmails } 
    });
    
    // Calculate totals
    const totalEmployees = employeesTotal + uniqueUsersCount;
    const activeEmployees = employeesActive + uniqueUsersCount;
    const onLeaveEmployees = employeesOnLeave;
    
    // Get department-wise count
    const departmentStats = await Employee.aggregate([
      { $match: { status: 'Active' } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'department' } },
      { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, department: { $ifNull: ['$department.name', '$_id'] }, count: 1 } },
      { $sort: { count: -1 } }
    ]);
    
    // Add users to General department
    if (uniqueUsersCount > 0) {
      const generalDeptIndex = departmentStats.findIndex(d => d.department === 'General');
      if (generalDeptIndex >= 0) {
        departmentStats[generalDeptIndex].count += uniqueUsersCount;
      } else {
        departmentStats.push({ department: 'General', count: uniqueUsersCount });
      }
    }
    
    // Get employment type distribution
    const employmentTypeStats = await Employee.aggregate([
      { $match: { status: 'Active' } },
      { $group: { _id: '$employmentType', count: { $sum: 1 } } },
      { $project: { _id: 0, type: '$_id', count: 1 } }
    ]);
    
    // Add users as Full-time
    if (uniqueUsersCount > 0) {
      const fullTimeIndex = employmentTypeStats.findIndex(e => e.type === 'Full-time');
      if (fullTimeIndex >= 0) {
        employmentTypeStats[fullTimeIndex].count += uniqueUsersCount;
      } else {
        employmentTypeStats.push({ type: 'Full-time', count: uniqueUsersCount });
      }
    }
    
    res.json({
      success: true,
      stats: {
        totalEmployees,
        activeEmployees,
        onLeaveEmployees,
        departmentStats,
        employmentTypeStats
      }
    });
  } catch (error) {
    console.error('❌ Get employee stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getEmployeeStats
};
