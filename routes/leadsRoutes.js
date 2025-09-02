const express = require("express");
const router = express.Router();
const multer = require("multer");
const { body } = require("express-validator");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const {
  uploadLeads,
  getAllLeads,
  getLeads,
  getLeadStats,
  getLead,
  updateLead,
  updateLeadStatus,
  updateLeadPoints,
  deleteLead,
  softDeleteLead,
  exportLeads,
  restoreLead,
  markNotConnected,
  scheduleCall,
  getScheduledCalls,
  getNotConnectedCalls,
  debugNotConnected,
  debugLeadStatus,
  completeCall,
  getCompletedCalls,
  getReadyToCallLeads,
  moveScheduledLeadsToQueue,

} = require("../controllers/leadsController");

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept all file types and let the processing logic handle validation
    const allowedExtensions = [".csv", ".xlsx", ".xls"];
    const fileExtension = file.originalname
      .toLowerCase()
      .substring(file.originalname.lastIndexOf("."));

    if (allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Invalid file type. Only ${allowedExtensions.join(
            ", "
          )} files are allowed.`
        ),
        false
      );
    }
  },
});

// Validation rules
const leadValidation = [
  body("name")
    .notEmpty()
    .withMessage("Name is required")
    .isString()
    .withMessage("Name must be a string")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),

  body("phone")
    .notEmpty()
    .withMessage("Phone is required")
    .isString()
    .withMessage("Phone must be a string")
    .trim()
    .isLength({ max: 20 })
    .withMessage("Phone number is too long"),



  body("status")
    .optional({ nullable: true, checkFalsy: true })
    .isIn(["New", "Qualified", "Negotiation", "Closed", "Lost"])
    .withMessage("Invalid status"),

  body("notes")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("Notes must be a string")
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Notes are too long"),
];

// Routes
// Upload leads from file - Admin only
router.post("/upload", auth, admin, upload.single("file"), uploadLeads);

// Get all leads (for Leads page - shows ALL leads regardless of status)
router.get("/all", auth, getAllLeads);

// Get active leads (for Call page - shows only non-completed leads)
router.get("/", auth, getLeads);

// Get lead statistics
router.get("/stats", auth, getLeadStats);

// Get completed calls
router.get("/completed-calls", auth, getCompletedCalls);

// Get scheduled calls
router.get("/scheduled-calls", auth, getScheduledCalls);

// Get not connected calls
router.get("/not-connected-calls", auth, getNotConnectedCalls);

// Get leads ready for call (scheduled time has passed)
router.get("/ready-to-call", auth, getReadyToCallLeads);

// Move scheduled leads back to call queue
router.post("/move-to-queue", auth, moveScheduledLeadsToQueue);

// Debug route to check not connected leads
router.get("/debug-not-connected", auth, debugNotConnected);

// Debug route to check a specific lead's status
router.get("/debug-lead/:leadId", auth, debugLeadStatus);

// Get single lead
router.get("/:id", auth, getLead);

// Update lead
router.put("/:id", auth, leadValidation, updateLead);

// Update lead status
router.patch("/:id/status", auth, updateLeadStatus);

// Update lead points after status update
router.patch("/:id/points", auth, updateLeadPoints);

// Complete a call for a lead
router.put("/:leadId/complete-call", auth, completeCall);

// Restore a completed lead back to active calls
router.patch("/:leadId/restore", auth, restoreLead);

// Schedule a call for a lead
router.patch("/:leadId/schedule", auth, scheduleCall);

// Mark a call as not connected
router.patch("/:leadId/not-connected", auth, markNotConnected);



// Delete lead (hard delete - completely remove from database) - Admin only
router.delete("/:id", auth, admin, deleteLead);

// Soft delete lead (mark as inactive)
router.patch("/:id/deactivate", auth, softDeleteLead);

// Export leads to Excel - Admin only
router.get("/export/excel", auth, admin, exportLeads);

module.exports = router;
