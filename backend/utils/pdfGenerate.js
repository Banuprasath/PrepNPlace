const{rgb}  = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit"); 

const path = require("path");
const fs = require("fs");
const { PDFDocument, StandardFonts } = require("pdf-lib");

const crypto = require("crypto");


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

module.exports = generatePdfBytes;