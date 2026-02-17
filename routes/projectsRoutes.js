const express = require('express');
const multer = require('multer');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const { createProject, updateProject, getProjects, getProjectById, getProjectFile, updateProjectStatus, getDeliveredProjects } = require('../controllers/projectsController');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

router.get('/delivered', auth, getDeliveredProjects);
router.get('/', auth, getProjects);
router.get('/:id', auth, getProjectById);
router.get('/:id/files/:filename', auth, getProjectFile);
router.patch('/:id/status', auth, updateProjectStatus);
router.put('/:id', auth, admin, upload.array('files', 10), updateProject);
router.post('/', auth, admin, upload.array('files', 10), createProject);

module.exports = router;
