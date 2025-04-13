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
    preparationStrategy: String,
    placementExperience: String,
    tipsAndTricks: String,
    readLink:String,
    visibility: String
}, { timestamps: true });

module.exports = mongoose.model("Experience", ExperienceSchema);

/*
CampgroundSchema.post('findOneAndDelete',async function(doc){
    

    if(doc){
        await Review.deleteMany({
            _id: {
                $in : doc.review
            }
        })
    }

})

*/
