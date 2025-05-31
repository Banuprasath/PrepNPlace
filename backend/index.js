const express = require("express");
const app = express();
const methodOverride = require("method-override");
const cors = require('cors');

const mongoose = require("mongoose");
const Experiences = require("./models/experiences");
const users = require("./models/users");
const bcrypt = require("bcrypt");

const session = require("express-session")
const path = require("path");
const fs = require("fs");
const generateHashedFileName = require("./utils/pdfGenerate")
const { PDFDocument, StandardFonts } = require("pdf-lib");

const crypto = require("crypto");
const experienceModel = require("./models/experiences");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
mongoose.connect("mongodb://localhost:27017/PrepNPlace");

app.use(methodOverride('_method'));
app.use(session({secret:"secret"}))

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error :"));
db.once("open", () => {
  console.log("Database Connected");
});

app.listen(3000,'0.0.0.0', () => {
    console.log("Server running on Port 3000");
});

app.set("view engine", "ejs");
app.use(cors());

// Home page with search functionality
app.get("/", async (req, res) => {
    const { search, skill, company } = req.query;
  //  let query = { visibility: { $ne: "None" } };
      let query ={visibility :{ $ne: "None"}};
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

    const user = "student"; // <-- Get user from session

    res.render("experience", { 
        experiences2, 
        allSkills, 
        allCompanies,
        currentSearch: search || '',
        currentSkill: skill || '',
        currentCompany: company || '',
        userStatus:  req.session.user_id
        // <-- Pass user to EJS
    });
});

// NEW: Read-only experience view
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

// NEW: PDF download endpoint
app.get("/experience/:id/download", async (req, res) => {
    const { id } = req.params;
    try {
        const experience = await Experiences.findById(id);
        if (!experience) {
            return res.status(404).send("Experience not found");
        }
        
        const fileName = `experience_${id}.pdf`;
        const filePath = await generatePdf(experience, fileName);
        
        res.download(filePath, `${experience.name}_${experience.company}_Experience.pdf`, (err) => {
            if (err) {
                console.error("Download error:", err);
            }
            // Optionally delete the temporary file
            fs.unlink(filePath, (unlinkErr) => {
                if (unlinkErr) console.error("Error deleting temp file:", unlinkErr);
            });
        });
    } catch (err) {
        console.error("Error generating PDF:", err);
        res.status(500).send("Error generating PDF");
    }
});

// Updated: New experience form - only for logged-in users
app.get("/new", (req, res) => {
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
    if (req.session.user_id) {
        const experienceList = await Experiences.find();
        res.render("admin/view", { experienceList });
    } else {
        res.send("You Naughty Boy login first!!!!!")
    }
})

app.get("/register", (req, res) => {
    res.render("admin/register")
})

app.post("/register", async (req, res) => {
    try {
        let newUser = req.body;
        const password = newUser.password;

        const hash = await bcrypt.hash(password, 10);
        newUser.password = hash;

        const user = new users(newUser);
        await user.save();

        res.status(201).render("admin/login");
    } catch (error) {
        if (error.code === 11000 && error.keyPattern) {
            res.status(400).send("Registration number or E-mail already exists");
        } else {
            console.error(error);
            res.status(500).send("Error during registration");
        }
    }
});


app.get("/login", (req, res) => {
    res.render("admin/login")
})

app.post("/login", async (req, res) => {


    if (req.session.user_id) {
        return res.redirect("/student");
    }
    const { regno, password } = req.body;

    if (regno === "admin" && password === "admin") {
        req.session.user_id = regno;
        return res.redirect("/admin");
    }

    const user = await users.findOne({ regno });

    if (!user) {
        return res.status(404).send("User Not Found");
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (validPassword) {
        req.session.user_id = user.regno;
        req.session.user_name = user.name;
        req.session.user_email = user.email;
        return res.redirect("/student");
    } else {
        return res.status(401).send("Invalid Credentials");
    }
});

app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/")
})

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

// UPDATED: Add experience - with authentication check and auto-fill
app.post("/experiences/add", async (req, res) => {
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

        const fileName = generateHashedFileName(newExperience.regno);
        const filePath = await generatePdf(newExperience, fileName);
        newExperience.readLink = `/uploads/${fileName}`;
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
    if (req.session.user_id) {
        const regNo = req.session.user_id;
        const experienceList = await Experiences.find({regno: regNo});
        res.render("student/sview", { experienceList });
    } else {
        res.send("You Naughty Boy login first!!!!!")
    }
})

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

        const fileName = generateHashedFileName(regno);
        const filePath = await generatePdf(updatedUser, fileName);

        updatedUser.readLink = `/uploads/${fileName}`;
        await updatedUser.save();

        const experienceList = await Experiences.find({ regno: regno });
        res.render("student/sview", { experienceList });

    } catch (err) {
        console.log(err)
        res.status(500).send("Server error");
    }
});




// UPDATED: Generate PDF function with skills
async function generatePdf(data, fileName) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.276, 841.890]);

    const { height } = page.getSize();

    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    let y = height - 50;

    function drawLabelAndValue(label, value) {
        const textValue = value ? value.toString() : "N/A";
        page.drawText(label, { x: 50, y, font: boldFont, size: 12 });
        y -= 20;
        
        // Handle long text by wrapping
        const maxWidth = 495;
        const words = textValue.split(' ');
        let line = '';
        
        for (let word of words) {
            const testLine = line + word + ' ';
            const testWidth = regularFont.widthOfTextAtSize(testLine, 12);
            
            if (testWidth > maxWidth && line !== '') {
                page.drawText(line.trim(), { x: 70, y, font: regularFont, size: 12 });
                y -= 15;
                line = word + ' ';
            } else {
                line = testLine;
            }
        }
        
        if (line.trim() !== '') {
            page.drawText(line.trim(), { x: 70, y, font: regularFont, size: 12 });
        }
        
        y -= 25;
    }

    drawLabelAndValue("Candidate Name:", data.name);
    drawLabelAndValue("Email:", data.email);
    drawLabelAndValue("Registration Number:", data.regno);
    drawLabelAndValue("Company:", data.company);
    drawLabelAndValue("Domain:", data.domain);
    drawLabelAndValue("Graduation Year:", data.year);
    drawLabelAndValue("Position Type:", data.type);
    
    // NEW: Display skills
    if (data.skills && data.skills.length > 0) {
        drawLabelAndValue("Skills Used:", data.skills.join(', '));
    }
    
    drawLabelAndValue("Preparation Strategy:", data.preparationStrategy);
    drawLabelAndValue("Placement Experience:", data.placementExperience);
    drawLabelAndValue("Tips And Tricks:", data.tipsAndTricks);
    
    if (data.preparationPlaylist) {
        drawLabelAndValue("Preparation Resources:", data.preparationPlaylist);
    }
    
    if (data.bonus) {
        drawLabelAndValue("Additional Insights:", data.bonus);
    }

    const pdfBytes = await pdfDoc.save();
    const filePath = path.join(__dirname, "uploads", fileName);
    fs.writeFileSync(filePath, pdfBytes);

    return filePath;
}