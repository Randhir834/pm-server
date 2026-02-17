const mongoose = require('mongoose');

const projectFileSchema = new mongoose.Schema({
  originalName: { type: String, required: true },
  filename: { type: String, required: true },
  mimetype: { type: String, default: '' },
  size: { type: Number, default: 0 },
  url: { type: String, required: true }
}, { _id: false });

const projectLinkSchema = new mongoose.Schema({
  label: { type: String, default: '' },
  url: { type: String, required: true }
}, { _id: false });

const projectSchema = new mongoose.Schema({
  projectId: { type: String, required: true, unique: true, index: true },
  clientName: { type: String, required: true, trim: true },
  projectType: { type: String, required: true, trim: true },
  startDate: { type: Date, required: true },
  deadline: { type: Date, required: true },
  projectValue: { type: Number, required: true, min: 0 },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  description: { type: String, default: '', trim: true },
  status: {
    type: String,
    enum: [
      'In Design',
      'Concept Shared',
      'Under Correction',
      'Delivered',
      'Client Pending',
      'Planned',
      'In Progress',
      'On Hold',
      'Completed',
      'Cancelled'
    ],
    default: 'In Design'
  },
  files: { type: [projectFileSchema], default: [] },
  links: { type: [projectLinkSchema], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, {
  timestamps: true,
  collection: 'projects'
});

projectSchema.index({ assignedTo: 1 });
projectSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Project', projectSchema);
