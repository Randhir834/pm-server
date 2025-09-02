const Lead = require("../models/Lead");
const xlsx = require("xlsx");
const { validationResult } = require("express-validator");

// Upload and process sheet file
const uploadLeads = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    console.log("📁 File upload details:", {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      assignedTo: req.body.assignedTo,
      userId: req.user.id,
    });

    let workbook;
    let jsonData;

    try {
      // Try to read the file as Excel/CSV
      workbook = xlsx.read(req.file.buffer, {
        type: "buffer",
        cellDates: true,
        cellNF: false,
        cellText: false,
      });

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No sheets found in the file",
        });
      }

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

      console.log("✅ File processed successfully:", {
        sheetName,
        totalRows: jsonData.length,
      });
    } catch (parseError) {
      console.error("❌ File parsing error:", parseError);
      return res.status(400).json({
        success: false,
        message:
          "Unable to read the file. Please ensure it is a valid Excel or CSV file.",
        error: parseError.message,
      });
    }

    if (jsonData.length < 2) {
      return res.status(400).json({
        success: false,
        message: "File must contain at least a header row and one data row",
      });
    }

    // Validate assignedTo if provided
    if (req.body.assignedTo) {
      const mongoose = require('mongoose');
      if (!mongoose.Types.ObjectId.isValid(req.body.assignedTo)) {
        return res.status(400).json({
          success: false,
          message: "Invalid assignedTo user ID",
        });
      }
    }

    const headers = jsonData[0].map((header) =>
      header ? header.toString().trim() : ""
    );
    const dataRows = jsonData.slice(1);

    // 🔍 DEBUG: Log the actual headers from uploaded file
    console.log("📋 UPLOADED FILE HEADERS:", headers);
    console.log("📋 HEADERS COUNT:", headers.length);
    headers.forEach((header, index) => {
      console.log(`  Column ${index}: "${header}" (length: ${header.length})`);
    });
    


    // Map headers to expected fields with flexible matching
    const headerMapping = {
      name: "name",
      "full name": "name",
      "first name": "name",
      "last name": "name",
      "contact name": "name",

      phone: "phone",
      "phone number": "phone",
      mobile: "phone",
      telephone: "phone",



      status: "status",
      "lead status": "status",

      source: "source",
      "lead source": "source",
      "source type": "source",

      notes: "notes",
      note: "notes",
      comments: "notes",
      description: "notes",
      points: "points",
      "important points": "points",
      "key points": "points",
    };

    const columnIndexes = {};
    headers.forEach((header, index) => {
      if (!header) return; // Skip empty headers

      const lowerHeader = header.toString().toLowerCase().trim();
      if (headerMapping[lowerHeader]) {
        columnIndexes[headerMapping[lowerHeader]] = index;
      }
    });


    console.log("📋 Header mapping:", {
      headers: headers,
      columnIndexes: columnIndexes,
    });



    // Validate required columns (allow index 0)
    if (typeof columnIndexes.name !== "number") {
      return res.status(400).json({
        success: false,
        message: 'File must contain "Name" column',
      });
    }

    const leads = [];
    const errors = [];

    dataRows.forEach((row, index) => {
      if (!row || row.length === 0) return;

      const lead = {
        name: columnIndexes.name !== undefined && row[columnIndexes.name] ? row[columnIndexes.name].toString().trim() : "",
        phone: columnIndexes.phone !== undefined && row[columnIndexes.phone] ? row[columnIndexes.phone].toString().trim() : "",
        status: columnIndexes.status !== undefined && row[columnIndexes.status] ? row[columnIndexes.status].toString().trim() : "New",
        source: columnIndexes.source !== undefined && row[columnIndexes.source] ? row[columnIndexes.source].toString().trim() : "Import",
        notes: columnIndexes.notes !== undefined && row[columnIndexes.notes] ? row[columnIndexes.notes].toString().trim() : "",
        points: columnIndexes.points !== undefined && row[columnIndexes.points] ? row[columnIndexes.points].toString().trim() : "",
        assignedTo: req.body.assignedTo || req.user.id,
        createdBy: req.user.id,
        additionalFields: {}
      };

      // Capture all additional columns that aren't in the standard mapping
      headers.forEach((header, headerIndex) => {
        if (!header) return; // Skip empty headers
        
        const lowerHeader = header.toString().toLowerCase().trim();
        const isStandardField = headerMapping[lowerHeader];
        
        // If this column is not a standard field, store it in additionalFields
        if (!isStandardField && row[headerIndex] !== undefined && row[headerIndex] !== null) {
          const value = row[headerIndex].toString().trim();
          if (value) { // Only store non-empty values
            lead.additionalFields[header] = value;
          }
        }
      });

      // Log the processed lead data for debugging
      console.log(`📝 Processed lead ${index + 2}:`, {
        name: lead.name,
        phone: lead.phone,
        status: lead.status,
        source: lead.source,
        notes: lead.notes,
        points: lead.points,
        additionalFields: lead.additionalFields,
        columnIndexes: columnIndexes,
        rowData: row
      });

      // Validate lead data
      if (!lead.name || lead.name.length < 2) {
        errors.push(
          `Row ${index + 2}: Name is required and must be at least 2 characters`
        );
        return;
      }

      // Validate status
      const validStatuses = [
        "New",
        "Qualified",
        "Negotiation",
        "Closed",
        "Lost",
      ];
      if (lead.status && !validStatuses.includes(lead.status)) {
        lead.status = "New";
      }

      leads.push(lead);
    });

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation errors found",
        errors,
      });
    }

    if (leads.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid leads found in the file",
      });
    }

    // Insert leads
    const insertedLeads = await Lead.insertMany(leads);

    console.log(`✅ Successfully inserted ${insertedLeads.length} leads`);
    
    // Log the first few inserted leads to verify data
    if (insertedLeads.length > 0) {
      console.log("📊 Sample of inserted leads:");
      insertedLeads.slice(0, 3).forEach((lead, index) => {
        console.log(`  Lead ${index + 1}:`, {
          name: lead.name,
          phone: lead.phone,
          status: lead.status,
          source: lead.source,
          notes: lead.notes,
          points: lead.points,
          additionalFields: lead.additionalFields
        });
      });
    }

    // Fetch the inserted leads with populated user data
    try {
      const populatedLeads = await Lead.find({
        _id: { $in: insertedLeads.map((lead) => lead._id) },
      })
        .populate("createdBy", "name")
        .populate("assignedTo", "name")
        .sort({ createdAt: -1 });

      console.log(
        `✅ Fetched ${populatedLeads.length} leads with populated user data`
      );

      res.status(201).json({
        success: true,
        message: `Successfully imported ${insertedLeads.length} leads`,
        count: insertedLeads.length,
        leads: populatedLeads,
      });
    } catch (populateError) {
      console.error("❌ Error populating user data:", populateError);
      // Fallback to unpopulated leads if population fails
      res.status(201).json({
        success: true,
        message: `Successfully imported ${insertedLeads.length} leads`,
        count: insertedLeads.length,
        leads: insertedLeads,
      });
    }
  } catch (error) {
    console.error("Upload leads error:", error);
    res.status(500).json({
      success: false,
      message: "Error processing file",
      error: error.message,
    });
  }
};

// Get all leads (for Leads page - shows ALL leads regardless of status)
const getAllLeads = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;
    const search = req.query.search;

    // Build query - show ALL leads regardless of call status
    let query = { isActive: true };

    // If user is not admin, only show leads assigned to them or created by them
    if (req.user.role !== "admin") {
      query.$or = [{ createdBy: req.user._id }, { assignedTo: req.user._id }];
    }

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { notes: { $regex: search, $options: "i" } },
      ];
    }

    // If limit is very high (like 1000), don't use pagination to show all data
    let leadsQuery = Lead.find(query)
      .populate("createdBy", "name")
      .populate("assignedTo", "name")
      .sort({ createdAt: -1 });

    if (limit < 1000) {
      const skip = (page - 1) * limit;
      leadsQuery = leadsQuery.skip(skip).limit(limit);
    }

    const leads = await leadsQuery;
    const total = await Lead.countDocuments(query);

    console.log(
      `All leads fetched: ${leads.length} leads, total: ${total}, filter: ${
        status || "all"
      }${limit >= 1000 ? ' (ALL LEADS - No pagination)' : ''}`
    );
    console.log(
      "Sample leads:",
      leads
        .slice(0, 3)
        .map((lead) => ({ id: lead._id, name: lead.name, status: lead.status, callCompleted: lead.callCompleted, scheduledAt: lead.scheduledAt }))
    );

    // Add cache control headers to prevent unnecessary API calls
    res.set({
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });

    res.json({
      success: true,
      leads,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get all leads error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching leads",
      error: error.message,
    });
  }
};

// Get leads (for Call page - shows both active and completed calls)
const getLeads = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;
    const search = req.query.search;

    // Build query based on user role
    // Show leads that are active (including completed calls)
    // Only exclude leads that are currently scheduled or marked as not connected
    // Note: If a lead is marked as not connected, it gets automatically scheduled for follow-up
    let query = { isActive: true };
    
    // Exclude leads that are currently scheduled or marked as not connected
    // But include completed calls even if they were previously scheduled/not connected
    query.$and = [
      { $or: [
        { scheduledAt: null },
        { callCompleted: true }  // Include completed calls even if they were scheduled
      ]},
      { $or: [
        { notConnectedAt: null },
        { callCompleted: true }  // Include completed calls even if they were marked as not connected
      ]}
    ];

    console.log('Initial query filters:', JSON.stringify(query, null, 2));

    // If user is not admin, only show leads assigned to them or created by them
    if (req.user.role !== "admin") {
      query.$or = [{ createdBy: req.user._id }, { assignedTo: req.user._id }];
    }

    if (status) {
      query.status = status;
    }

    if (search) {
      // Create a separate search condition that respects the main filters
      const searchCondition = {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
          { notes: { $regex: search, $options: "i" } },
        ]
      };
      
      // Combine search with existing filters
      query = { ...query, ...searchCondition };
    }

    // If limit is very high (like 1000), don't use pagination to show all data
    let leadsQuery = Lead.find(query)
      .populate("createdBy", "name")
      .populate("assignedTo", "name")
      .sort({ createdAt: -1 });

    if (limit < 1000) {
      const skip = (page - 1) * limit;
      leadsQuery = leadsQuery.skip(skip).limit(limit);
    }

    const leads = await leadsQuery;
    const total = await Lead.countDocuments(query);

    console.log(
      `Leads fetched: ${leads.length} leads (including completed calls), total: ${total}, filter: ${
        status || "all"
      }${limit >= 1000 ? ' (ALL LEADS - No pagination)' : ''}`
    );
    console.log('Query filters:', JSON.stringify(query, null, 2));
    console.log('Sample leads with status:', leads.slice(0, 3).map(lead => ({
      id: lead._id,
      name: lead.name,
      status: lead.status,
      callCompleted: lead.callCompleted,
      callCompletedAt: lead.callCompletedAt,
      scheduledAt: lead.scheduledAt,
      notConnectedAt: lead.notConnectedAt
    })));
    console.log(
      "Sample leads:",
      leads
        .slice(0, 3)
        .map((lead) => ({ id: lead._id, name: lead.name, status: lead.status }))
    );

    // Add cache control headers to prevent unnecessary API calls
    res.set({
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });

    res.json({
      success: true,
      leads,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get leads error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching leads",
      error: error.message,
    });
  }
};

// Get lead statistics (including completed calls)
const getLeadStats = async (req, res) => {
  try {
    // Build match condition based on user role
    // Include both active and completed calls in statistics
    // Only exclude leads that are currently scheduled or marked as not connected
    let matchCondition = { isActive: true };
    
    // Exclude leads that are currently scheduled or marked as not connected
    // But include completed calls even if they were previously scheduled/not connected
    matchCondition.$and = [
      { $or: [
        { scheduledAt: null },
        { callCompleted: true }  // Include completed calls even if they were scheduled
      ]},
      { $or: [
        { notConnectedAt: null },
        { callCompleted: true }  // Include completed calls even if they were marked as not connected
      ]}
    ];

    // If user is not admin, only show stats for leads assigned to them or created by them
    if (req.user.role !== "admin") {
      matchCondition.$or = [
        { createdBy: req.user._id },
        { assignedTo: req.user._id },
      ];
    }

    const stats = await Lead.aggregate([
      { $match: matchCondition },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const totalLeads = await Lead.countDocuments(matchCondition);

    const statsMap = {
      total: totalLeads,
      new: 0,
      qualified: 0,
      negotiation: 0,
      closed: 0,
      lost: 0,
    };

    stats.forEach((stat) => {
      if (stat._id) {
        const statusKey = stat._id.toLowerCase();
        if (statsMap.hasOwnProperty(statusKey)) {
          statsMap[statusKey] = stat.count;
        }
      }
    });

    console.log(
      "Lead stats for user:",
      req.user._id,
      "role:",
      req.user.role,
      statsMap
    );

    // Add cache control headers to prevent unnecessary API calls
    res.set({
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });

    res.json({
      success: true,
      stats: statsMap,
    });
  } catch (error) {
    console.error("Get lead stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching lead statistics",
      error: error.message,
    });
  }
};

// Get single lead
const getLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate("createdBy", "name")
      .populate("assignedTo", "name");

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    res.json({
      success: true,
      lead,
    });
  } catch (error) {
    console.error("Get lead error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching lead",
      error: error.message,
    });
  }
};

// Update lead
const updateLead = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }

    const lead = await Lead.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate("createdBy", "name")
      .populate("assignedTo", "name");

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    res.json({
      success: true,
      message: "Lead updated successfully",
      lead,
    });
  } catch (error) {
    console.error("Update lead error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating lead",
      error: error.message,
    });
  }
};

// Update lead status
const updateLeadStatus = async (req, res) => {
  try {
    const { status } = req.body;

    // Validate status
    const validStatuses = ["New", "Qualified", "Negotiation", "Closed", "Lost"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be one of: " + validStatuses.join(", "),
      });
    }

    // Use findOneAndUpdate with optimistic locking to prevent race conditions
    const lead = await Lead.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      {
        status,
        updatedAt: new Date(), // Ensure timestamp is updated
      },
      {
        new: true,
        runValidators: true,
        // Add optimistic locking to prevent concurrent updates
        timestamps: true,
      }
    )
      .populate("createdBy", "name")
      .populate("assignedTo", "name");

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Add cache control headers
    res.set({
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });

    res.json({
      success: true,
      message: "Lead status updated successfully",
      lead,
    });
  } catch (error) {
    console.error("Update lead status error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating lead status",
      error: error.message,
    });
  }
};

// Update lead points
const updateLeadPoints = async (req, res) => {
  try {
    const { points } = req.body;

    // Validate points
    if (points && typeof points !== 'string') {
      return res.status(400).json({
        success: false,
        message: "Points must be a string",
      });
    }

    // Use findOneAndUpdate with optimistic locking to prevent race conditions
    const lead = await Lead.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      {
        points: points || '',
        updatedAt: new Date(), // Ensure timestamp is updated
      },
      {
        new: true,
        runValidators: true,
        // Add optimistic locking to prevent concurrent updates
        timestamps: true,
      }
    )
      .populate("createdBy", "name")
      .populate("assignedTo", "name");

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Add cache control headers
    res.set({
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });

    res.json({
      success: true,
      message: "Lead points updated successfully",
      lead,
    });
  } catch (error) {
    console.error("Update lead points error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating lead points",
      error: error.message,
    });
  }
};

// Delete lead (hard delete - completely remove from database)
const deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    res.json({
      success: true,
      message: "Lead deleted successfully",
    });
  } catch (error) {
    console.error("Delete lead error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting lead",
      error: error.message,
    });
  }
};

// Export leads
const exportLeads = async (req, res) => {
  try {
    // Export ALL leads regardless of call status
    const leads = await Lead.find({ isActive: true })
      .populate("createdBy", "name")
      .populate("assignedTo", "name")
      .sort({ createdAt: -1 });

    const workbook = xlsx.utils.book_new();
    const worksheetData = leads.map((lead) => {
      const baseData = {
        Name: lead.name,
        Phone: lead.phone,
        Status: lead.status,
        Notes: lead.notes,
        "Important Points": lead.points || "",
        "Uploaded By": lead.createdBy ? lead.createdBy.name : "Unknown",
        "Assigned To": lead.assignedTo ? lead.assignedTo.name : "",
        "Created Date": lead.createdAt.toISOString().split("T")[0],
        "Last Updated": lead.updatedAt.toISOString().split("T")[0],
      };

      // Add all additional fields to the export
      if (lead.additionalFields && typeof lead.additionalFields === 'object') {
        Object.keys(lead.additionalFields).forEach(key => {
          baseData[key] = lead.additionalFields[key];
        });
      }

      return baseData;
    });

    const worksheet = xlsx.utils.json_to_sheet(worksheetData);
    xlsx.utils.book_append_sheet(workbook, worksheet, "Leads");

    const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=leads_export_${
        new Date().toISOString().split("T")[0]
      }.xlsx`
    );
    res.send(buffer);
  } catch (error) {
    console.error("Export leads error:", error);
    res.status(500).json({
      success: false,
      message: "Error exporting leads",
      error: error.message,
    });
  }
};

// Soft delete lead (mark as inactive but keep in database)
const softDeleteLead = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    res.json({
      success: true,
      message: "Lead deactivated successfully",
    });
  } catch (error) {
    console.error("Soft delete lead error:", error);
    res.status(500).json({
      success: false,
      message: "Error deactivating lead",
      error: error.message,
    });
  }
};

// Restore a completed lead back to active calls
const restoreLead = async (req, res) => {
  try {
    const { leadId } = req.params;
    const { callCompleted, callCompletedAt, callCompletedBy, scheduledAt, notConnectedAt } = req.body;
    const userId = req.user.id;

    // Find the lead
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    // Update lead to mark as not completed
    lead.callCompleted = callCompleted;
    lead.callCompletedAt = callCompletedAt;
    lead.callCompletedBy = callCompletedBy;
    
    // Clear the scheduled time if provided
    if (scheduledAt === null) {
      lead.scheduledAt = null;
    }
    
    // Clear the not connected timestamp if provided
    if (notConnectedAt === null) {
      lead.notConnectedAt = null;
      // Also clear scheduled time if it was auto-scheduled from not connected
      if (lead.scheduledAt) {
        lead.scheduledAt = null;
      }
    }
    
    // Clear the call history for this lead
    lead.callHistory = [];

    console.log('Restoring lead:', {
      leadId: lead._id,
      leadName: lead.name,
      callCompleted: lead.callCompleted,
      scheduledAt: lead.scheduledAt,
      notConnectedAt: lead.notConnectedAt,
      beforeSave: true
    });

    await lead.save();

    // Verify the lead was saved correctly
    const savedLead = await Lead.findById(leadId);
    console.log('Lead restored successfully:', {
      leadId: lead._id,
      afterSave: true,
      savedLead: {
        callCompleted: savedLead.callCompleted,
        scheduledAt: savedLead.scheduledAt,
        notConnectedAt: savedLead.notConnectedAt
      }
    });

    res.status(200).json({
      success: true,
      message: 'Lead restored successfully',
      lead
    });
  } catch (error) {
    console.error('Error restoring lead:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Mark a call as not connected
const markNotConnected = async (req, res) => {
  try {
    const { leadId } = req.params;
    const { notConnectedAt } = req.body;
    const userId = req.user.id;

    // Find the lead
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    // Update lead with not connected timestamp
    lead.notConnectedAt = new Date(notConnectedAt);
    lead.lastContacted = new Date();
    
    // Automatically schedule a follow-up call exactly 2 hours later
    const followUpTime = new Date(notConnectedAt);
    followUpTime.setHours(followUpTime.getHours() + 2);
    lead.scheduledAt = followUpTime;

    console.log('Marking lead as not connected:', {
      leadId: lead._id,
      leadName: lead.name,
      notConnectedAt: lead.notConnectedAt,
      scheduledAt: lead.scheduledAt,
      beforeSave: true
    });

    await lead.save();

    console.log('Lead saved successfully:', {
      leadId: lead._id,
      notConnectedAt: lead.notConnectedAt,
      afterSave: true
    });

    res.status(200).json({
      success: true,
      message: 'Call marked as not connected successfully',
      lead
    });
  } catch (error) {
    console.error('Error marking call as not connected:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Schedule a call for a lead
const scheduleCall = async (req, res) => {
  try {
    const { leadId } = req.params;
    const { scheduledAt } = req.body;
    const userId = req.user.id;

    // Find the lead
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    // Update lead with scheduled time
    lead.scheduledAt = new Date(scheduledAt);
    lead.lastContacted = new Date();

    await lead.save();

    res.status(200).json({
      success: true,
      message: 'Call scheduled successfully',
      lead
    });
  } catch (error) {
    console.error('Error scheduling call:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Complete a call for a lead
const completeCall = async (req, res) => {
  try {
    const { leadId } = req.params;
    const { callStatus, completedAt } = req.body;
    const userId = req.user.id;

    // Find the lead
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    // Update lead with call completion info
    lead.lastContacted = new Date(completedAt);
    lead.callCompleted = true;
    lead.callCompletedAt = new Date(completedAt);
    lead.callCompletedBy = userId;
    
    // Add to call history
    if (!lead.callHistory) {
      lead.callHistory = [];
    }
    lead.callHistory.push({
      status: callStatus,
      completedAt: new Date(completedAt),
      completedBy: userId
    });

    await lead.save();



    res.status(200).json({
      success: true,
      message: 'Call completed successfully',
      lead
    });
  } catch (error) {
    console.error('Error completing call:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Debug: Check for not connected leads
const debugNotConnected = async (req, res) => {
  try {
    const notConnectedLeads = await Lead.find({ notConnectedAt: { $ne: null } });
    console.log('Debug: Found not connected leads:', notConnectedLeads.length);
    notConnectedLeads.forEach(lead => {
      console.log('Not connected lead:', {
        id: lead._id,
        name: lead.name,
        notConnectedAt: lead.notConnectedAt
      });
    });

    res.status(200).json({
      success: true,
      count: notConnectedLeads.length,
      leads: notConnectedLeads
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({
      success: false,
      message: 'Debug error',
      error: error.message
    });
  }
};

// Debug: Check a specific lead's status
const debugLeadStatus = async (req, res) => {
  try {
    const { leadId } = req.params;
    const lead = await Lead.findById(leadId);
    
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    console.log('Debug lead status:', {
      id: lead._id,
      name: lead.name,
      callCompleted: lead.callCompleted,
      scheduledAt: lead.scheduledAt,
      notConnectedAt: lead.notConnectedAt,
      isActive: lead.isActive
    });

    res.status(200).json({
      success: true,
      lead: {
        id: lead._id,
        name: lead.name,
        callCompleted: lead.callCompleted,
        scheduledAt: lead.scheduledAt,
        notConnectedAt: lead.notConnectedAt,
        isActive: lead.isActive
      }
    });
  } catch (error) {
    console.error('Debug lead status error:', error);
    res.status(500).json({
      success: false,
      message: 'Debug error',
      error: error.message
    });
  }
};

// Get all not connected calls
const getNotConnectedCalls = async (req, res) => {
  try {
    const userId = req.user.id;

    // Build query based on user role
    let query = { isActive: true, notConnectedAt: { $ne: null } };

    // If user is not admin, only show leads assigned to them or created by them
    if (req.user.role !== "admin") {
      query.$or = [{ createdBy: req.user._id }, { assignedTo: req.user._id }];
    }

    const notConnectedLeads = await Lead.find(query)
      .populate("createdBy", "name")
      .populate("assignedTo", "name")
      .sort({ notConnectedAt: -1 });

    res.status(200).json({
      success: true,
      notConnectedLeads
    });
  } catch (error) {
    console.error('Error fetching not connected calls:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get all scheduled calls
const getScheduledCalls = async (req, res) => {
  try {
    const userId = req.user.id;

    // Build query based on user role
    // Show leads that are scheduled (including auto-scheduled follow-ups from not connected)
    let query = { isActive: true, scheduledAt: { $ne: null } };

    // If user is not admin, only show leads assigned to them or created by them
    if (req.user.role !== "admin") {
      query.$or = [{ createdBy: req.user._id }, { assignedTo: req.user._id }];
    }

    const scheduledLeads = await Lead.find(query)
      .populate("createdBy", "name")
      .populate("assignedTo", "name")
      .sort({ scheduledAt: 1 });

    console.log('Scheduled calls query:', JSON.stringify(query, null, 2));
    console.log('Found scheduled leads:', scheduledLeads.length);

    res.status(200).json({
      success: true,
      scheduledLeads
    });
  } catch (error) {
    console.error('Error fetching scheduled calls:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get all completed calls
const getCompletedCalls = async (req, res) => {
  try {
    const userId = req.user.id;

    // Build query based on user role
    let query = { isActive: true, callCompleted: true };

    // If user is not admin, only show leads assigned to them or created by them
    if (req.user.role !== "admin") {
      query.$or = [{ createdBy: req.user._id }, { assignedTo: req.user._id }];
    }

    const completedLeads = await Lead.find(query)
      .populate("createdBy", "name")
      .populate("assignedTo", "name")
      .populate("callCompletedBy", "name")
      .sort({ callCompletedAt: -1 });

    res.status(200).json({
      success: true,
      completedLeads
    });
  } catch (error) {
    console.error('Error fetching completed calls:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get leads ready for call (scheduled time has passed)
const getReadyToCallLeads = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();

    // Build query for leads that are scheduled and ready to call
    let query = { 
      isActive: true, 
      scheduledAt: { $ne: null, $lte: now },
      callCompleted: { $ne: true }
    };

    // If user is not admin, only show leads assigned to them or created by them
    if (req.user.role !== "admin") {
      query.$or = [{ createdBy: req.user._id }, { assignedTo: req.user._id }];
    }

    const readyToCallLeads = await Lead.find(query)
      .populate("createdBy", "name")
      .populate("assignedTo", "name")
      .sort({ scheduledAt: 1 });

    res.status(200).json({
      success: true,
      readyToCallLeads
    });
  } catch (error) {
    console.error('Error fetching ready to call leads:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Move scheduled leads back to call queue when their time arrives
const moveScheduledLeadsToQueue = async (req, res) => {
  try {
    const now = new Date();
    
    // Find leads that are scheduled and ready to call
    const scheduledLeads = await Lead.find({
      isActive: true,
      scheduledAt: { $ne: null, $lte: now },
      callCompleted: { $ne: true }
    });

    let movedCount = 0;
    
    for (const lead of scheduledLeads) {
      // Clear the scheduled time to move it back to the call queue
      lead.scheduledAt = null;
      await lead.save();
      movedCount++;
      
      console.log(`Moved lead ${lead.name} (${lead._id}) back to call queue`);
    }

    res.status(200).json({
      success: true,
      message: `Successfully moved ${movedCount} leads back to call queue`,
      movedCount
    });
  } catch (error) {
    console.error('Error moving scheduled leads to queue:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};



module.exports = {
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
};
