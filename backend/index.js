const express = require("express");
const app = express();
const methodOverride = require("method-override");
//const experiences = require("./dummy");

const mongoose = require("mongoose");
const Experiences = require("./models/experiences");
const users = require("./models/users");
//Encrypt
const bcrypt = require("bcrypt");

//Session
const session = require("express-session")
const path = require("path");
const fs = require("fs");
const generateHashedFileName = require("./utils/pdfGenerate")
const { PDFDocument, StandardFonts } = require("pdf-lib");


//hashing
const crypto = require("crypto");
const experienceModel = require("./models/experiences");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
mongoose.connect("mongodb://localhost:27017/PrepNPlace");


//Override

app.use(methodOverride('_method'));
app.use(session({secret:"secret"}))

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error :"));
db.once("open", () => {
  console.log("Database Connected");
});


//-----------------------------------SERVER SIDE ---------------

app.listen(3000, () => {
    console.log("Server running on Port 3000");
});

app.set("view engine", "ejs");

app.get("/", async (req, res) => {
    //const experiences2 =experiences.filter((exp)=>(exp.visiblity == "None"))
    const experiences2=await Experiences.find();
    res.render("experience", { experiences2 });
});

app.get("/new", (req, res) => {
    res.render("addExp");
});



//Adming

app.get("/admin",async (req,res)=>{
    if(req.session.user_id){
        
    const experienceList=await Experiences.find();
    res.render("admin/view", { experienceList });

    }else{
        res.send("You Naughty Boy login first!!!!!")
    }
})

app.get("/register",(req,res)=>{
    res.render("admin/register")
})


app.post("/register", async (req, res) => {
    try {
      let newUser = req.body;
      const password = newUser.password;
  
      // Hash the password
      const hash = await bcrypt.hash(password, 10);
      newUser.password = hash;
      console.log(hash);
  
      // Create and save user
      const user = new users(newUser);
      await user.save();
  
      res.status(201).render("admin/login");
    } catch (error) {
      console.error(error);
      res.status(500).send("Error during registration");
    }
  });
  
app.get("/login",(req,res)=>{
    //const {username,password}=req.body;

    res.render("admin/login")

})


app.post("/login", async (req, res) => {
    const { regno, password } = req.body;

    //Dummy Admin Logic
    if (regno === "admin") {
        req.session.user_id = regno;
        
        return res.redirect("/admin");
    }
    //Dummy Admin Logic

    const user = await users.findOne({ regno });

    if (!user) {
        return res.status(404).send("User Not Found");
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (validPassword) {
        req.session.user_id = user.regno;

       

        return res.redirect("/student");
    } else {
        return res.status(401).send("Invalid Credentials");
    }
});


app.post("/logout",(req,res)=>{
    req.session.destroy();
    res.redirect("/login")
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
       console.log(experience);

        res.redirect("/admin"); // or wherever you want to go after update
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
         console.log(experience);

        res.redirect("/admin"); // or wherever you want to go after update
    } catch (err) {
        console.error("Update error:", err);
        res.status(500).send("Error updating experience");
    }
});

app.delete("/admin/experiences/:id", async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
        const experience = await Experiences.findByIdAndDelete(id);
        // console.log(experience);

        res.redirect("/admin"); 
    } catch (err) {
        console.error("Delete error:", err);
        res.status(500).send("Error Deleteing experience");
    }
});


//---------------------------------------------------------------------------------STUDENT VIEW-----------------------------------------

app.post("/experiences/add", async (req, res) => {
    try {
        let newExperience = req.body;

        const fileName = generateHashedFileName(newExperience.regno);
        const filePath = await generatePdf(newExperience, fileName);
        newExperience.readLink = `/uploads/${fileName}`;
        newExperience.visiblity = "None";

        const experienceEntry = new Experiences(newExperience);
        await experienceEntry.save();

        res.redirect("/");
    } catch (err) {
        console.error("Error saving experience:", err);
        res.status(500).send("Internal Server Error");
    }
});



app.get("/student",async (req,res)=>{
    if(req.session.user_id){
        const regNo = req.session.user_id;
        const experienceList=await Experiences.find({regno: regNo});
        res.render("student/sview", { experienceList });
    
        }else{
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


// -------------------------UPDATE THE DATA ------------------

app.put("/student/edit/:id", async (req, res) => {
    const { id } = req.params;
    const { regno } = req.body;

    try {
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



/*
-----------------------GENERATE PDF-----------------------------

*/

async function generatePdf(data, fileName) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.276, 841.890]);  // A4 size in points

    const { height } = page.getSize();

    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    let y = height - 50;

    function drawLabelAndValue(label, value) {
        // Ensure the value is a string, defaulting to "N/A" if undefined or empty
        const textValue = value ? value : "N/A";
        page.drawText(label, { x: 50, y, font: boldFont, size: 12 });
        y -= 20;
        page.drawText(textValue, { x: 70, y, font: regularFont, size: 12 });
        y -= 30;
    }

    drawLabelAndValue("Candidate Name:", data.name);
    drawLabelAndValue("Email:", data.email);
    drawLabelAndValue("Company:", data.company);
    //drawLabelAndValue("Read Link:", data.readLink);
    drawLabelAndValue("Domain:", data.domain);
    drawLabelAndValue("Graduation Year:", data.year);
    drawLabelAndValue("Intern Type:", data.type);
    drawLabelAndValue("Preparation Strategy", data.preparationStrategy);
    drawLabelAndValue("Placement Experience", data.placementExperience);
    drawLabelAndValue("Tips And Tricks", data.tipsAndTricks);

    const pdfBytes = await pdfDoc.save();
    const filePath = path.join(__dirname, "uploads", fileName);
    fs.writeFileSync(filePath, pdfBytes);

    return filePath;
}
