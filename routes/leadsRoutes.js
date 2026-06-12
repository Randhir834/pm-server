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
  scheduleCall,
  getScheduledCalls,

} = require("../controllers/leadsController");

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit (reduced from 10MB for better security)
    files: 1, // Only allow 1 file at a time
  },
  fileFilter: (req, file, cb) => {
    // Accept only specific file types
    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
    ];
    
    const allowedExtensions = [".csv", ".xlsx", ".xls"];
    const fileExtension = file.originalname
      .toLowerCase()
      .substring(file.originalname.lastIndexOf("."));

    if (allowedExtensions.includes(fileExtension) && allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed.`
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

// Get scheduled calls
router.get("/scheduled-calls", auth, getScheduledCalls);

// Get single lead
router.get("/:id", auth, getLead);

// Update lead
router.put("/:id", auth, leadValidation, updateLead);

// Update lead status
router.patch("/:id/status", auth, updateLeadStatus);

// Update lead points after status update
router.patch("/:id/points", auth, updateLeadPoints);

// Restore a completed lead back to active calls
router.patch("/:leadId/restore", auth, restoreLead);

// Schedule a call for a lead
router.patch("/:leadId/schedule", auth, scheduleCall);



// Delete lead (hard delete - completely remove from database) - Admin only
router.delete("/:id", auth, admin, deleteLead);

// Soft delete lead (mark as inactive)
router.patch("/:id/deactivate", auth, softDeleteLead);

// Export leads to Excel - Admin only
router.get("/export/excel", auth, admin, exportLeads);

module.exports = router;
