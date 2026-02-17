const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Project = require('../models/Project');

const PROJECT_STATUSES = [
  'In Design',
  'Concept Shared',
  'Under Correction',
  'Delivered',
  'Closed',
  'Client Pending',
  'Planned',
  'In Progress',
  'On Hold',
  'Completed',
  'Cancelled'
];

const ADMIN_ONLY_STATUSES = new Set(['Delivered', 'Closed', 'Client Pending']);

const ensureUploadsDir = () => {
  const uploadsPath = path.join(process.cwd(), 'uploads', 'projects');
  fs.mkdirSync(uploadsPath, { recursive: true });
  return uploadsPath;
};

const generateProjectId = async () => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  const candidate = `PRJ-${datePart}-${randomPart}`;

  const exists = await Project.exists({ projectId: candidate });
  if (exists) return generateProjectId();
  return candidate;
};

const parseLinks = (rawLinks) => {
  if (!rawLinks) return [];
  if (Array.isArray(rawLinks)) return rawLinks;

  try {
    const parsed = JSON.parse(rawLinks);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(l => l && typeof l.url === 'string' && l.url.trim())
      .map(l => ({
        label: typeof l.label === 'string' ? l.label.trim() : '',
        url: l.url.trim()
      }));
  } catch {
    return [];
  }
};

const getProjectFile = async (req, res) => {
  try {
    const { id, filename } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project id'
      });
    }

    const project = await Project.findById(id).select('assignedTo files');
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const isAdmin = req.user.role === 'admin';
    if (!isAdmin && String(project.assignedTo) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const fileMeta = (project.files || []).find(f => f && f.filename === filename);
    if (!fileMeta) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const filePath = path.join(process.cwd(), 'uploads', 'projects', filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    if (fileMeta.mimetype) {
      res.setHeader('Content-Type', fileMeta.mimetype);
    }

    const downloadName = fileMeta.originalName || filename;
    res.setHeader('Content-Disposition', `inline; filename="${downloadName.replace(/"/g, '')}"`);

    return res.sendFile(filePath);
  } catch (error) {
    console.error('Get project file error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project id'
      });
    }

    const isAdmin = req.user.role === 'admin';

    const project = await Project.findById(id)
      .populate('assignedTo', 'name _id')
      .populate('createdBy', 'name _id');

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    if (!isAdmin && String(project.assignedTo?._id) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const payload = project.toObject();
    if (!isAdmin) {
      delete payload.projectValue;
    }

    return res.json({
      success: true,
      project: payload
    });
  } catch (error) {
    console.error('Get project by id error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Admin only
const createProject = async (req, res) => {
  try {
    const {
      clientName,
      projectType,
      startDate,
      deadline,
      projectValue,
      assignedTo,
      description,
      status,
      links
    } = req.body;

    if (!clientName || !projectType || !startDate || !deadline || projectValue === undefined || !assignedTo) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid assignedTo user ID'
      });
    }

    const uploadsDir = ensureUploadsDir();

    const uploadedFiles = (req.files || []).map(file => {
      const safeName = `${Date.now()}_${Math.random().toString(16).slice(2)}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const filePath = path.join(uploadsDir, safeName);
      fs.writeFileSync(filePath, file.buffer);

      return {
        originalName: file.originalname,
        filename: safeName,
        mimetype: file.mimetype,
        size: file.size,
        url: `/uploads/projects/${safeName}`
      };
    });

    const project = await Project.create({
      projectId: await generateProjectId(),
      clientName: clientName.trim(),
      projectType: projectType.trim(),
      startDate: new Date(startDate),
      deadline: new Date(deadline),
      projectValue: Number(projectValue),
      assignedTo,
      description: typeof description === 'string' ? description.trim() : '',
      status: status || 'In Design',
      files: uploadedFiles,
      links: parseLinks(links),
      createdBy: req.user._id
    });

    const populated = await Project.findById(project._id)
      .populate('assignedTo', 'name _id')
      .populate('createdBy', 'name _id');

    return res.status(201).json({
      success: true,
      project: populated
    });
  } catch (error) {
    console.error('Create project error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Admin only
const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project id'
      });
    }

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const {
      clientName,
      projectType,
      startDate,
      deadline,
      projectValue,
      assignedTo,
      description,
      status,
      links
    } = req.body;

    if (typeof clientName === 'string' && clientName.trim()) {
      project.clientName = clientName.trim();
    }

    if (typeof projectType === 'string' && projectType.trim()) {
      project.projectType = projectType.trim();
    }

    if (startDate) {
      project.startDate = new Date(startDate);
    }

    if (deadline) {
      project.deadline = new Date(deadline);
    }

    if (projectValue !== undefined && projectValue !== '') {
      project.projectValue = Number(projectValue);
    }

    if (assignedTo) {
      if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid assignedTo user ID'
        });
      }
      project.assignedTo = assignedTo;
    }

    if (typeof description === 'string') {
      project.description = description.trim();
    }

    if (typeof status === 'string' && status.trim()) {
      const trimmedStatus = status.trim();
      if (!PROJECT_STATUSES.includes(trimmedStatus)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status'
        });
      }
      project.status = trimmedStatus;
    }

    if (links !== undefined) {
      project.links = parseLinks(links);
    }

    if (Array.isArray(req.files) && req.files.length > 0) {
      const uploadsDir = ensureUploadsDir();
      const uploadedFiles = req.files.map(file => {
        const safeName = `${Date.now()}_${Math.random().toString(16).slice(2)}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const filePath = path.join(uploadsDir, safeName);
        fs.writeFileSync(filePath, file.buffer);

        return {
          originalName: file.originalname,
          filename: safeName,
          mimetype: file.mimetype,
          size: file.size,
          url: `/uploads/projects/${safeName}`
        };
      });

      project.files = [...(project.files || []), ...uploadedFiles];
    }

    await project.save();

    const populated = await Project.findById(project._id)
      .populate('assignedTo', 'name _id')
      .populate('createdBy', 'name _id');

    return res.json({
      success: true,
      project: populated
    });
  } catch (error) {
    console.error('Update project error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

const getProjects = async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const query = isAdmin ? {} : { assignedTo: req.user._id };

    const projects = await Project.find(query)
      .populate('assignedTo', 'name _id')
      .lean()
      .sort({ createdAt: -1 });

    const sanitized = isAdmin
      ? projects
      : projects.map(p => {
          const obj = { ...p };
          delete obj.projectValue;
          return obj;
        });

    return res.json({
      success: true,
      projects: sanitized
    });
  } catch (error) {
    console.error('Get projects error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

const updateProjectStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project id'
      });
    }

    const trimmedStatus = typeof status === 'string' ? status.trim() : '';
    if (!trimmedStatus) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    if (!PROJECT_STATUSES.includes(trimmedStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const isAdmin = req.user.role === 'admin';
    if (!isAdmin && ADMIN_ONLY_STATUSES.has(trimmedStatus)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const project = await Project.findById(id)
      .populate('assignedTo', 'name _id')
      .populate('createdBy', 'name _id');

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    if (!isAdmin && String(project.assignedTo?._id) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    project.status = trimmedStatus;
    await project.save();

    const payload = project.toObject();
    if (!isAdmin) {
      delete payload.projectValue;
    }

    return res.json({
      success: true,
      project: payload
    });
  } catch (error) {
    console.error('Update project status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

const getDeliveredProjects = async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const query = isAdmin
      ? { status: 'Delivered' }
      : { status: 'Delivered', assignedTo: req.user._id };

    const projects = await Project.find(query)
      .populate('assignedTo', 'name _id')
      .populate('createdBy', 'name _id')
      .lean()
      .sort({ createdAt: -1 });

    const sanitized = isAdmin
      ? projects
      : projects.map(p => {
          const obj = { ...p };
          delete obj.projectValue;
          return obj;
        });

    return res.json({
      success: true,
      projects: sanitized
    });
  } catch (error) {
    console.error('Get delivered projects error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  createProject,
  updateProject,
  getProjects,
  getProjectById,
  getProjectFile,
  updateProjectStatus,
  getDeliveredProjects
};
