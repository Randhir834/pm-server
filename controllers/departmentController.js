const { validationResult } = require('express-validator');
const Department = require('../models/Department');
const Employee = require('../models/Employee');

// @desc    Get all departments
// @route   GET /api/departments
// @access  Private
const getAllDepartments = async (req, res) => {
  try {
    const { isActive, search } = req.query;
    
    const query = {};
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } }
      ];
    }
    
    const departments = await Department.find(query)
      .populate('head', 'firstName lastName employeeId')
      .sort({ name: 1 });
    
    // Get employee count for each department
    const departmentsWithCount = await Promise.all(
      departments.map(async (dept) => {
        const employeeCount = await Employee.countDocuments({ 
          department: dept._id, 
          status: 'Active' 
        });
        return {
          ...dept.toObject(),
          employeeCount
        };
      })
    );
    
    res.json({
      success: true,
      count: departmentsWithCount.length,
      departments: departmentsWithCount
    });
  } catch (error) {
    console.error('❌ Get all departments error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get department by ID
// @route   GET /api/departments/:id
// @access  Private
const getDepartmentById = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id)
      .populate('head', 'firstName lastName employeeId position email')
      .populate('createdBy', 'name email');
    
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }
    
    // Get all employees in this department
    const employees = await Employee.find({ 
      department: department._id,
      status: 'Active'
    }).select('firstName lastName employeeId position');
    
    res.json({
      success: true,
      department: {
        ...department.toObject(),
        employees
      }
    });
  } catch (error) {
    console.error('❌ Get department by ID error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create new department
// @route   POST /api/departments
// @access  Private/Admin
const createDepartment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { name, code } = req.body;
    
    // Check if department with name or code already exists
    const existingDept = await Department.findOne({
      $or: [{ name }, { code }]
    });
    
    if (existingDept) {
      if (existingDept.name === name) {
        return res.status(400).json({ message: 'Department with this name already exists' });
      }
      if (existingDept.code === code) {
        return res.status(400).json({ message: 'Department with this code already exists' });
      }
    }
    
    const department = new Department({
      ...req.body,
      createdBy: req.user._id
    });
    
    await department.save();
    
    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      department
    });
  } catch (error) {
    console.error('❌ Create department error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update department
// @route   PUT /api/departments/:id
// @access  Private/Admin
const updateDepartment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const department = await Department.findById(req.params.id);
    
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }
    
    // Check for duplicate name or code if being updated
    if (req.body.name && req.body.name !== department.name) {
      const existingDept = await Department.findOne({ name: req.body.name });
      if (existingDept) {
        return res.status(400).json({ message: 'Department with this name already exists' });
      }
    }
    
    if (req.body.code && req.body.code !== department.code) {
      const existingDept = await Department.findOne({ code: req.body.code });
      if (existingDept) {
        return res.status(400).json({ message: 'Department with this code already exists' });
      }
    }
    
    // Update department
    Object.keys(req.body).forEach(key => {
      department[key] = req.body[key];
    });
    
    await department.save();
    
    await department.populate('head', 'firstName lastName employeeId');
    
    res.json({
      success: true,
      message: 'Department updated successfully',
      department
    });
  } catch (error) {
    console.error('❌ Update department error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete department
// @route   DELETE /api/departments/:id
// @access  Private/Admin
const deleteDepartment = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }
    
    // Check if department has employees
    const employeeCount = await Employee.countDocuments({ department: department._id });
    
    if (employeeCount > 0) {
      return res.status(400).json({ 
        message: `Cannot delete department. ${employeeCount} employee(s) are assigned to this department.` 
      });
    }
    
    await Department.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Department deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete department error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment
};
