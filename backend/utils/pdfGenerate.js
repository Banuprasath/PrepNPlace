

const crypto = require("crypto");



// Serve static files from uploads folder
//app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


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
    drawLabelAndValue("Read Link:", data.readLink);
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



function generateHashedFileName(regno) {
    const hash = crypto.createHash("md5")
        .update(regno + Date.now())
        .digest("hex")
        .slice(0, 8); // short hash

    return `${regno}_${hash}_experience.pdf`;
}

module.exports =  generateHashedFileName ;