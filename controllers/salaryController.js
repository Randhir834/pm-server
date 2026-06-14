const mongoose = require('mongoose');
const Salary = require('../models/Salary');
const User = require('../models/User');

// @desc    Create new salary entry
// @route   POST /api/salary
// @access  Private/Admin
const createSalary = async (req, res) => {
  try {
    const { employeeId, month, basicSalary, allowances, deductions, bonus, totalSalary, notes } = req.body;
    
    // Validate required fields
    if (!employeeId || !month || !basicSalary || totalSalary === undefined) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({ message: 'Invalid employee ID format' });
    }
    
    // Check if employee exists
    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    
    // Check if salary entry already exists for this month
    const existingSalary = await Salary.findOne({
      employeeId,
      month: new Date(month)
    });
    
    if (existingSalary) {
      return res.status(400).json({ 
        message: 'Salary entry already exists for this month. Please update the existing entry instead.' 
      });
    }
    
    // Create salary entry
    const salary = new Salary({
      employeeId,
      month: new Date(month),
      basicSalary: parseFloat(basicSalary),
      allowances: parseFloat(allowances) || 0,
      deductions: parseFloat(deductions) || 0,
      bonus: parseFloat(bonus) || 0,
      totalSalary: parseFloat(totalSalary),
      notes,
      createdBy: req.user._id
    });
    
    await salary.save();
    
    res.status(201).json({
      message: 'Salary entry created successfully',
      salary
    });
  } catch (error) {
    console.error('Create salary error:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: 'Salary entry already exists for this employee and month' 
      });
    }
    
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get salary entries for an employee
// @route   GET /api/salary/:employeeId
// @access  Private/Admin
const getEmployeeSalaries = async (req, res) => {
  try {
    const { employeeId } = req.params;
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({ message: 'Invalid employee ID format' });
    }
    
    // Check if employee exists
    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    
    // Get all salary entries for this employee, sorted by month (newest first)
    const salaries = await Salary.find({ employeeId })
      .sort({ month: -1 })
      .populate('createdBy', 'name email');
    
    res.json({ salaries });
  } catch (error) {
    console.error('Get employee salaries error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get a specific salary entry
// @route   GET /api/salary/entry/:id
// @access  Private/Admin
const getSalaryById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid salary ID format' });
    }
    
    const salary = await Salary.findById(id)
      .populate('employeeId', 'name email designation')
      .populate('createdBy', 'name email');
    
    if (!salary) {
      return res.status(404).json({ message: 'Salary entry not found' });
    }
    
    res.json({ salary });
  } catch (error) {
    console.error('Get salary by ID error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update salary entry
// @route   PUT /api/salary/:id
// @access  Private/Admin
const updateSalary = async (req, res) => {
  try {
    const { id } = req.params;
    const { basicSalary, allowances, deductions, bonus, totalSalary, status, paidDate, notes } = req.body;
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid salary ID format' });
    }
    
    const salary = await Salary.findById(id);
    if (!salary) {
      return res.status(404).json({ message: 'Salary entry not found' });
    }
    
    // Update fields if provided
    if (basicSalary !== undefined) salary.basicSalary = parseFloat(basicSalary);
    if (allowances !== undefined) salary.allowances = parseFloat(allowances);
    if (deductions !== undefined) salary.deductions = parseFloat(deductions);
    if (bonus !== undefined) salary.bonus = parseFloat(bonus);
    if (totalSalary !== undefined) salary.totalSalary = parseFloat(totalSalary);
    if (status) salary.status = status;
    if (paidDate) salary.paidDate = new Date(paidDate);
    if (notes !== undefined) salary.notes = notes;
    
    await salary.save();
    
    res.json({
      message: 'Salary entry updated successfully',
      salary
    });
  } catch (error) {
    console.error('Update salary error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete salary entry
// @route   DELETE /api/salary/:id
// @access  Private/Admin
const deleteSalary = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid salary ID format' });
    }
    
    const salary = await Salary.findById(id);
    if (!salary) {
      return res.status(404).json({ message: 'Salary entry not found' });
    }
    
    await Salary.findByIdAndDelete(id);
    
    res.json({ message: 'Salary entry deleted successfully' });
  } catch (error) {
    console.error('Delete salary error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all salary entries with filters
// @route   GET /api/salary
// @access  Private/Admin
const getAllSalaries = async (req, res) => {
  try {
    const { month, status, employeeId } = req.query;
    
    // Build filter object
    const filter = {};
    if (month) filter.month = new Date(month);
    if (status) filter.status = status;
    if (employeeId) {
      if (!mongoose.Types.ObjectId.isValid(employeeId)) {
        return res.status(400).json({ message: 'Invalid employee ID format' });
      }
      filter.employeeId = employeeId;
    }
    
    const salaries = await Salary.find(filter)
      .sort({ month: -1, createdAt: -1 })
      .populate('employeeId', 'name email designation department')
      .populate('createdBy', 'name email');
    
    res.json({ salaries });
  } catch (error) {
    console.error('Get all salaries error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Mark salary as paid
// @route   PATCH /api/salary/:id/paid
// @access  Private/Admin
const markSalaryAsPaid = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid salary ID format' });
    }
    
    const salary = await Salary.findById(id);
    if (!salary) {
      return res.status(404).json({ message: 'Salary entry not found' });
    }
    
    salary.status = 'paid';
    salary.paidDate = new Date();
    await salary.save();
    
    res.json({
      message: 'Salary marked as paid',
      salary
    });
  } catch (error) {
    console.error('Mark salary as paid error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createSalary,
  getEmployeeSalaries,
  getSalaryById,
  updateSalary,
  deleteSalary,
  getAllSalaries,
  markSalaryAsPaid
};
