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

const generatePdfBytes = require("./utils/pdfGenerate")

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
    if (regno === "admin" && password === "blackburn") {
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


