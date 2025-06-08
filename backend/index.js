const express = require("express");
const app = express();
const methodOverride = require("method-override");
const cors = require('cors');
require('dotenv').config();

const {  rgb } = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit"); 

const mongoose = require("mongoose");
const Experiences = require("./models/experiences");
const users = require("./models/users");
const bcrypt = require("bcrypt");

const session = require("express-session");
const MongoStore = require('connect-mongo');
const path = require("path");
const fs = require("fs");
const { PDFDocument, StandardFonts } = require("pdf-lib");

const crypto = require("crypto");
const experienceModel = require("./models/experiences");

const DB_URL = process.env.MONGO_URI;

if (!DB_URL) {
    console.error('Error: MONGO_URI environment variable is required');
    process.exit(1);
}

console.log('MongoDB URI found:', DB_URL ? 'Yes' : 'No');
console.log('Environment:', process.env.NODE_ENV);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(methodOverride('_method'));

// Updated CORS configuration
app.use(cors({
    origin: process.env.FRONTEND_URL || true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

const mongooseOptions = {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    dbName: 'PrepNPlace'
};

mongoose.connect(DB_URL, mongooseOptions)
    .then(() => console.log("Database Connected Successfully"))
    .catch(err => {
        console.error("Database connection error:", err);
        process.exit(1);
    });

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error :"));

const store = MongoStore.create({
    mongoUrl: DB_URL,
    crypto: {
        secret: process.env.SESSION_SECRET || "blackburn"
    },
    touchAfter: 24 * 60 * 60
});

store.on("error", function (e) {
    console.log("Session store error:", e);
});

// Updated session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || "blackburn",
    resave: false,
    saveUninitialized: false,
    store: store,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24,
        secure: false, 
        httpOnly: true,
        sameSite: 'lax'
    },
    name: 'sessionId' 
}));

// Add session debugging middleware
app.use((req, res, next) => {
    console.log('Session ID:', req.sessionID);
    console.log('Session data:', req.session);
    next();
});

app.set("view engine", "ejs");

const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on Port ${port}`);
});

// Home page with search functionality
app.get("/", async (req, res) => {
    const { search, skill, company } = req.query;
    let query = { visibility: { $ne: "None" } };
    
    if (search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { company: { $regex: search, $options: 'i' } },
            { domain: { $regex: search, $options: 'i' } }
        ];
    }

    if (skill) {
        query.skills = { $in: [skill] };
    }

    if (company) {
        query.company = company;
    }

    const experiences2 = await Experiences.find(query);
    const allSkills = await Experiences.distinct('skills');
    const allCompanies = await Experiences.distinct('company');

    res.render("experience", { 
        experiences2, 
        allSkills, 
        allCompanies,
        currentSearch: search || '',
        currentSkill: skill || '',
        currentCompany: company || '',
        userStatus: req.session.user_id
    });
});

// Read-only experience view
app.get("/experience/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const experience = await Experiences.findById(id);
        if (!experience) {
            return res.status(404).send("Experience not found");
        }
        res.render("experience-detail", { experience });
    } catch (err) {
        console.error("Error fetching experience:", err);
        res.status(500).send("Server error");
    }
});

// UPDATED: PDF download endpoint - generate PDF in memory
app.get("/experience/:id/download", async (req, res) => {
    const { id } = req.params;
    try {
        const experience = await Experiences.findById(id);
        if (!experience) {
            return res.status(404).send("Experience not found");
        }
        
        // Generate PDF in memory instead of saving to disk
        const pdfBytes = await generatePdfBytes(experience);
        
        // Set headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${experience.name}_${experience.company}_Experience.pdf"`);
        res.setHeader('Content-Length', pdfBytes.length);
        
        // Send PDF directly from memory
        res.send(Buffer.from(pdfBytes));
        
    } catch (err) {
        console.error("Error generating PDF:", err);
        res.status(500).send("Error generating PDF");
    }
});

// New experience form - only for logged-in users
app.get("/new", (req, res) => {
    console.log("New experience page - Session user_id:", req.session.user_id);
    if (!req.session.user_id) {
        return res.redirect("/login");
    }

    res.render("addExp", {
        user: {
            regno: req.session.user_id,
            name: req.session.user_name,
            email: req.session.user_email
        }
    });
});

// Admin routes
app.get("/admin", async (req, res) => {
    console.log("Admin page - Session user_id:", req.session.user_id);
    if (req.session.user_id==="admin") {
        const experienceList = await Experiences.find();
        res.render("admin/view", { experienceList });
    } else {
        res.redirect("/login")
    }
});

app.get("/register", (req, res) => {
    res.render("admin/register")
});

app.post("/register", async (req, res) => {
    try {
        let newUser = req.body;
        const password = newUser.password;

        console.log("Registering user:", newUser.regno);
        console.log("Password length:", password.length);

        const hash = await bcrypt.hash(password, 10);
        newUser.password = hash;

        console.log("Generated hash:", hash);
        console.log("Hash length:", hash.length);

        const user = new users(newUser);
        await user.save();

        console.log("User saved successfully");
        res.status(201).render("admin/login");
    } catch (error) {
        console.error("Registration error:", error);
        if (error.code === 11000 && error.keyPattern) {
            res.status(400).send("Registration number or E-mail already exists");
        } else {
            res.status(500).send("Error during registration");
        }
    }
});

app.get("/login", (req, res) => {
    console.log("Login page accessed - Current session:", req.session.user_id);
    res.render("admin/login")
});

// Enhanced login route with extensive debugging
app.post("/login", async (req, res) => {
    console.log("=== LOGIN ATTEMPT START ===");
    console.log("Request body:", req.body);
    console.log("Session before login:", req.session);
    console.log("Session ID:", req.sessionID);
    
    const { regno, password } = req.body;

    console.log("Login attempt for regno:", regno);
    console.log("Password provided:", password ? "Yes" : "No");
    console.log("Password length:", password ? password.length : 0);

    // Admin login check
    if (regno === "admin" && password === "admin") {
        console.log("Admin login detected");
        req.session.user_id = regno;
        console.log("Session after admin login:", req.session);
        return res.redirect("/admin");
    }
    
    // Check if already logged in
    if (req.session.user_id) {
        console.log("User already logged in:", req.session.user_id);
        return res.redirect("/student");
    }

    try {
        console.log("Searching for user with regno:", regno);
        const user = await users.findOne({ regno });
        console.log("User found:", user ? "Yes" : "No");
        
        if (!user) {
            console.log("User not found in database");
            return res.status(404).send("User Not Found");
        }

        console.log("User details:", {
            regno: user.regno,
            name: user.name,
            email: user.email,
            hasPassword: !!user.password,
            passwordLength: user.password ? user.password.length : 0
        });

        // Extensive password debugging
        console.log("=== PASSWORD COMPARISON DEBUG ===");
        console.log("Stored password hash:", user.password);
        console.log("Input password:", password);
        
        // Test bcrypt functionality
        try {
            const testHash = await bcrypt.hash(password, 10);
            console.log("Fresh hash of input password:", testHash);
            const testCompare = await bcrypt.compare(password, testHash);
            console.log("Fresh hash comparison test:", testCompare);
        } catch (bcryptError) {
            console.error("Bcrypt test error:", bcryptError);
        }
        
        // Main password comparison
        const validPassword = await bcrypt.compare(password, user.password);
        console.log("Password comparison result:", validPassword);
        
        if (validPassword) {
            console.log("Password valid - setting session");
            req.session.user_id = user.regno;
            req.session.user_name = user.name;
            req.session.user_email = user.email;
            
            // Save session explicitly
            req.session.save((err) => {
                if (err) {
                    console.error("Session save error:", err);
                    return res.status(500).send("Session save error");
                }
                console.log("Session saved successfully:", req.session);
                console.log("=== LOGIN ATTEMPT END - SUCCESS ===");
                return res.redirect("/student");
            });
        } else {
            console.log("Password invalid");
            console.log("=== LOGIN ATTEMPT END - INVALID PASSWORD ===");
            return res.status(401).send("Invalid Credentials");
        }
    } catch (error) {
        console.error("Login error:", error);
        console.log("=== LOGIN ATTEMPT END - ERROR ===");
        return res.status(500).send("Server error during login");
    }
});

app.get("/logout", (req, res) => {
    console.log("Logout - destroying session for user:", req.session.user_id);
    req.session.destroy((err) => {
        if (err) {
            console.error("Session destroy error:", err);
        }
        res.redirect("/");
    });
});

app.put("/admin/experiences/:id", async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
        const experience = await Experiences.findByIdAndUpdate(
            id,
            { status: status, visibility: true }, 
            { new: true } 
        );
        res.redirect("/admin");
    } catch (err) {
        console.error("Update error:", err);
        res.status(500).send("Error updating experience");
    }
});

app.put("/admin/experiences/d/:id", async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
        const experience = await Experiences.findByIdAndUpdate(
            id,
            { status: status, visibility: "None" }, 
            { new: true } 
        );
        res.redirect("/admin");
    } catch (err) {
        console.error("Update error:", err);
        res.status(500).send("Error updating experience");
    }
});

app.delete("/admin/experiences/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const experience = await Experiences.findByIdAndDelete(id);
        res.redirect("/admin"); 
    } catch (err) {
        console.error("Delete error:", err);
        res.status(500).send("Error Deleting experience");
    }
});

// UPDATED: Add experience - removed PDF generation
app.post("/experiences/add", async (req, res) => {
    console.log("Add experience - Session user_id:", req.session.user_id);
    if (!req.session.user_id) {
        return res.status(401).send("Please login to add experience");
    }
    
    try {
        let newExperience = req.body;
        
        // Parse skills from comma-separated string
        if (newExperience.skills) {
            newExperience.skills = newExperience.skills
                .split(',')
                .map(skill => skill.trim())
                .filter(skill => skill.length > 0);
        }

        // Remove PDF generation - just set visibility
        newExperience.visibility = "None";

        const experienceEntry = new Experiences(newExperience);
        await experienceEntry.save();

        res.redirect("/student");
    } catch (err) {
        console.error("Error saving experience:", err);
        res.status(500).send("Internal Server Error");
    }
});

app.get("/student", async (req, res) => {
    console.log("Student page - Session user_id:", req.session.user_id);
    if (req.session.user_id) {
        const regNo = req.session.user_id;
        const experienceList = await Experiences.find({regno: regNo});
        res.render("student/sview", { experienceList });
    } else {
        res.redirect("/login")
    }
});

app.get("/edit/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const userData = await experienceModel.findById(id);

        if (!userData) {
            console.log("User not found for ID:", id);
            return res.status(404).send("User not found");
        }

        res.render("student/sedit", { userData });

    } catch (err) {
        console.error("Error during findById:", err);
        res.status(500).send("Server error");
    }
});

// UPDATED: Edit experience - removed PDF generation
app.put("/student/edit/:id", async (req, res) => {
    const { id } = req.params;
    const { regno } = req.body;

    try {
        // Parse skills if they exist
        if (req.body.skills) {
            req.body.skills = req.body.skills
                .split(',')
                .map(skill => skill.trim())
                .filter(skill => skill.length > 0);
        }

        const updatedUser = await experienceModel.findByIdAndUpdate(
            id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!updatedUser) {
            return res.status(404).send("User not found");
        }

        const experienceList = await Experiences.find({ regno: regno });
        res.render("student/sview", { experienceList });

    } catch (err) {
        console.log(err)
        res.status(500).send("Server error");
    }
});

// Debug route to test session
app.get("/debug-session", (req, res) => {
    res.json({
        sessionID: req.sessionID,
        session: req.session,
        cookies: req.headers.cookie,
        user_id: req.session.user_id
    });
});


// Optional: Admin cleanup route to remove existing PDF files and readLink references
app.get("/admin/cleanup-pdfs", async (req, res) => {
    if (req.session.user_id !== "admin") {
        return res.status(403).send("Admin access required");
    }
    
    try {
        const uploadsDir = path.join(__dirname, 'uploads');
        let deletedCount = 0;
        
        // Check if uploads directory exists
        if (fs.existsSync(uploadsDir)) {
            const files = fs.readdirSync(uploadsDir);
            
            files.forEach(file => {
                if (file.endsWith('.pdf')) {
                    fs.unlinkSync(path.join(uploadsDir, file));
                    deletedCount++;
                }
            });
        }
        
        // Remove readLink field from all experiences
        await Experiences.updateMany({}, { $unset: { readLink: "" } });
        
        res.send(`Cleanup completed! Deleted ${deletedCount} PDF files and removed readLink references from database.`);
    } catch (err) {
        console.error("Cleanup error:", err);
        res.status(500).send("Error during cleanup: " + err.message);
    }
});






// UPDATED: PDF generation function - returns bytes instead of file path



async function generatePdfBytes(data) {
    const pdfDoc = await PDFDocument.create();
    
    // Register fontkit to enable custom font support
    pdfDoc.registerFontkit(fontkit);
    
    // Define page dimensions and margins
    const pageWidth = 595.276; // A4 width
    const pageHeight = 841.890; // A4 height
    const margin = 50;
    const contentWidth = pageWidth - (margin * 2);
    
    let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    let currentY = pageHeight - margin;
    
    // Embed custom fonts (Download these fonts and place in your project)
    // Option 1: Use system fonts (if available)
    let titleFont, labelFont, valueFont, headerFont;
    
    try {
        // Try to load custom fonts first (recommended approach)
        const regularFontBytes = fs.readFileSync('./fonts/Roboto-Regular.ttf');
        const boldFontBytes = fs.readFileSync('./fonts/Roboto-Bold.ttf');
        
        titleFont = await pdfDoc.embedFont(boldFontBytes);
        labelFont = await pdfDoc.embedFont(boldFontBytes);
        valueFont = await pdfDoc.embedFont(regularFontBytes);
        headerFont = await pdfDoc.embedFont(boldFontBytes);
    } catch (error) {
        console.log('Custom fonts not found, trying alternative approach...');
        
        // Fallback: Try with embedded base fonts that support more characters
        // These are built into pdf-lib and support more characters than standard fonts
        try {
            const { StandardFonts } = require('pdf-lib');
            // Use TimesRoman instead of Helvetica - it has better Unicode support
            titleFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
            labelFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
            valueFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
            headerFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
        } catch (fallbackError) {
            // Last resort: Use Courier which has the most reliable character support
            titleFont = await pdfDoc.embedFont(StandardFonts.CourierBold);
            labelFont = await pdfDoc.embedFont(StandardFonts.CourierBold);
            valueFont = await pdfDoc.embedFont(StandardFonts.Courier);
            headerFont = await pdfDoc.embedFont(StandardFonts.CourierBold);
        }
    }
    
    // Color definitions using rgb() function
    const primaryColor = rgb(0.2, 0.4, 0.8); // Blue
    const secondaryColor = rgb(0.4, 0.4, 0.4); // Gray
    const textColor = rgb(0.1, 0.1, 0.1); // Dark gray
    const lightBgColor = rgb(0.95, 0.95, 0.98); // Light background
    const whiteColor = rgb(1, 1, 1); // White
    const separatorColor = rgb(0.8, 0.8, 0.8); // Light gray for separators
    
    // Enhanced text sanitization function
    function sanitizeText(text) {
        if (!text) return 'N/A';
        
        return text.toString()
            // Handle various quote types
            .replace(/['']/g, "'")
            .replace(/[""]/g, '"')
            // Handle dashes
            .replace(/[—–]/g, '-')
            // Handle special characters
            .replace(/•/g, '*')
            .replace(/…/g, '...')
            .replace(/©/g, '(c)')
            .replace(/®/g, '(R)')
            .replace(/™/g, '(TM)')
            // Handle various spaces
            .replace(/[\u00A0\u2000-\u200B\u2028\u2029]/g, ' ')
            // Handle accented characters by decomposing and removing diacriticals
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            // Handle remaining problematic Unicode characters
            .replace(/[^\u0020-\u007E]/g, '?')
            // Clean up multiple spaces and trim
            .replace(/\s+/g, ' ')
            .trim();
    }
    
    // Safe text drawing function with error handling
    function drawTextSafely(page, text, options) {
        try {
            const safeText = sanitizeText(text);
            page.drawText(safeText, options);
            return true;
        } catch (error) {
            console.warn('Text drawing error:', error.message);
            // Try with even more basic text
            const basicText = text.toString().replace(/[^\x20-\x7E]/g, '?').substring(0, 100);
            try {
                page.drawText(basicText, options);
                return true;
            } catch (finalError) {
                console.error('Failed to draw text:', finalError.message);
                page.drawText('Text rendering error', options);
                return false;
            }
        }
    }
    
    // Helper function to add a new page when needed
    function addNewPageIfNeeded(requiredSpace = 80) {
        if (currentY < margin + requiredSpace) {
            currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
            currentY = pageHeight - margin;
            return true;
        }
        return false;
    }
    
    // Helper function to draw a horizontal line
    function drawHorizontalLine(y, color = separatorColor, thickness = 1) {
        currentPage.drawLine({
            start: { x: margin, y: y },
            end: { x: pageWidth - margin, y: y },
            thickness: thickness,
            color: color
        });
    }
    
    // Safe text width calculation
    function getTextWidth(text, font, fontSize) {
        try {
            const safeText = sanitizeText(text);
            return font.widthOfTextAtSize(safeText, fontSize);
        } catch (error) {
            // Estimate width if calculation fails
            return safeText.length * fontSize * 0.6;
        }
    }
    
    // Helper function to wrap text and return lines
    function wrapText(text, font, fontSize, maxWidth) {
        if (!text) return ['N/A'];
        
        // Sanitize text before processing
        const sanitizedText = sanitizeText(text);
        const words = sanitizedText.split(' ');
        const lines = [];
        let currentLine = '';
        
        for (const word of words) {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            const testWidth = getTextWidth(testLine, font, fontSize);
            
            if (testWidth > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        
        if (currentLine) {
            lines.push(currentLine);
        }
        
        return lines.length > 0 ? lines : ['N/A'];
    }
    
    // Helper function to draw wrapped text
    function drawWrappedText(text, x, font, fontSize, color = textColor, maxWidth = contentWidth - 20) {
        const lines = wrapText(text, font, fontSize, maxWidth);
        
        lines.forEach((line, index) => {
            addNewPageIfNeeded(20);
            drawTextSafely(currentPage, line, {
                x: x,
                y: currentY,
                font: font,
                size: fontSize,
                color: color
            });
            currentY -= fontSize + 4; // Line height
        });
        
        return lines.length;
    }
    
    // Helper function to draw a section with label and value
    function drawSection(label, value, isLargeSection = false) {
        // Add spacing before section
        currentY -= 5;
        addNewPageIfNeeded(isLargeSection ? 120 : 60);
        
        // Draw section background (subtle)
        if (isLargeSection) {
            currentPage.drawRectangle({
                x: margin - 5,
                y: currentY - 10,
                width: contentWidth + 10,
                height: 20,
                color: lightBgColor
            });
        }
        
        // Draw label
        drawTextSafely(currentPage, label, {
            x: margin,
            y: currentY,
            font: labelFont,
            size: 11,
            color: primaryColor
        });
        currentY -= 18;
        
        // Draw separator line under label
        drawHorizontalLine(currentY + 8, separatorColor, 0.5);
        currentY -= 8;
        
        // Draw value with proper wrapping
        const linesDrawn = drawWrappedText(value, margin + 10, valueFont, 10);
        
        // Add spacing after section
        currentY -= 10;
    }
    
    // Start building the PDF
    
    // Header section with title
    addNewPageIfNeeded(100);
    
    // Draw header background
    currentPage.drawRectangle({
        x: margin - 10,
        y: currentY - 5,
        width: contentWidth + 20,
        height: 40,
        color: primaryColor
    });
    
    // Title
    drawTextSafely(currentPage, '    MCA PLACEMENT EXPERIENCE REPORT', {
        x: margin,
        y: currentY,
        font: titleFont,
        size: 16,
        color: whiteColor // White text on blue background
    });
    currentY -= 50;
    
    // Basic Information Section
    currentY -= 10;
    drawTextSafely(currentPage, 'CANDIDATE INFORMATION', {
        x: margin,
        y: currentY,
        font: headerFont,
        size: 13,
        color: primaryColor
    });
    currentY -= 5;
    drawHorizontalLine(currentY, primaryColor, 2);
    currentY -= 20;
    
    // Create a table-like structure for basic info
    const basicInfo = [
        ['Name:', data.name],
        ['Email:', data.email],
        ['Registration Number:', data.regno],
        ['Company:', data.company],
        ['Domain:', data.domain],
        ['Placed Year:', data.year],
        ['Position Type:', data.type]
    ];
    
    basicInfo.forEach(([label, value]) => {
        addNewPageIfNeeded(25);
        
        // Draw label
        drawTextSafely(currentPage, label, {
            x: margin,
            y: currentY,
            font: labelFont,
            size: 10,
            color: secondaryColor
        });
        
        // Draw value
        const displayValue = sanitizeText(value) || 'N/A';
        drawTextSafely(currentPage, displayValue.toString(), {
            x: margin + 150,
            y: currentY,
            font: valueFont,
            size: 10,
            color: textColor
        });
        
        currentY -= 16;
    });
    
    // Skills section (if exists)
    if (data.skills && data.skills.length > 0) {
        currentY -= 15;
        addNewPageIfNeeded(40);
        
        drawTextSafely(currentPage, 'TECHNICAL SKILLS', {
            x: margin,
            y: currentY,
            font: headerFont,
            size: 13,
            color: primaryColor
        });
        currentY -= 5;
        drawHorizontalLine(currentY, primaryColor, 2);
        currentY -= 20;
        
        // Draw skills as tags
        const skillsText = data.skills.join(' • ');
        drawWrappedText(skillsText, margin + 10, valueFont, 10);
        currentY -= 10;
    }
    
    // Large text sections
    const largeSections = [
        ['PREPARATION STRATEGY', data.preparationStrategy],
        ['PLACEMENT EXPERIENCE', data.placementExperience],
        ['TIPS AND TRICKS', data.tipsAndTricks]
    ];
    
    // Optional sections
    if (data.preparationPlaylist) {
        largeSections.push(['PREPARATION RESOURCES', data.preparationPlaylist]);
    }
    
    if (data.bonus) {
        largeSections.push(['ADDITIONAL INSIGHTS', data.bonus]);
    }
    
    largeSections.forEach(([label, value]) => {
        if (value && value.toString().trim()) {
            currentY -= 15;
            addNewPageIfNeeded(80);
            
            // Section header
            drawTextSafely(currentPage, label, {
                x: margin,
                y: currentY,
                font: headerFont,
                size: 13,
                color: primaryColor
            });
            currentY -= 5;
            drawHorizontalLine(currentY, primaryColor, 2);
            currentY -= 20;
            
            // Section content with better formatting
            drawWrappedText(value, margin + 10, valueFont, 10);
            currentY -= 5;
        }
    });
    
    // Footer on last page
    addNewPageIfNeeded(40);
    currentY = margin + 20;
    
    drawHorizontalLine(currentY + 10, separatorColor, 1);
    drawTextSafely(currentPage, 'Generated on: ' + new Date().toLocaleDateString(), {
        x: margin,
        y: currentY,
        font: valueFont,
        size: 8,
        color: secondaryColor
    });
    
    drawTextSafely(currentPage, 'PrepNPlace - Placement Experience Repository', {
        x: pageWidth - margin - 200,
        y: currentY,
        font: valueFont,
        size: 8,
        color: secondaryColor
    });
    
    return await pdfDoc.save();
}