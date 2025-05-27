const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ExperienceSchema = new Schema({
    regno: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    email: String,
    company: String,
    domain: String,
    year: String,
    type: String,
    skills: [{
        type: String,
        trim: true
    }], // New field for dynamic skills
    preparationStrategy: String,
    placementExperience: String,
    tipsAndTricks: String,
    preparationPlaylist: String, // Added missing field from form
    bonus: String, // Added missing field from form
    readLink: String,
    visibility: String,
    status: {
        type: String,
        default: "pending"
    }
}, { timestamps: true });

// Index for better search performance on skills
ExperienceSchema.index({ skills: 1 });
ExperienceSchema.index({ company: 1 });
ExperienceSchema.index({ domain: 1 });

module.exports = mongoose.model("Experience", ExperienceSchema);