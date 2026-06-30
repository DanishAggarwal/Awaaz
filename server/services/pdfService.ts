import PDFDocument from "pdfkit";
import { Buffer } from "buffer";

export async function generateCivicReportPDF(
  issueData: any,
  comments: any[],
  imageBuffer: Buffer | null
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));

      // Colors
      const primaryColor = "#1E293B"; // Dark Slate
      const secondaryColor = "#4A5568"; // Cool Gray
      const accentColor = "#D97706"; // Amber
      const lightBg = "#F8FAFC"; // Very light blue/gray
      const darkText = "#0F172A"; // Almost black
      const lightText = "#64748B"; // Muted gray
      const borderCol = "#E2E8F0";

      // Header (Awaaz Branding)
      doc.fillColor(primaryColor).fontSize(20).font("Helvetica-Bold").text("AWAAZ", 50, 50);
      doc.fillColor(accentColor).fontSize(8).font("Helvetica-Bold").text("CIVIC ACCOUNTABILITY PLATFORM", 50, 72);
      
      // Title of Document (Right-aligned)
      doc.fillColor(primaryColor).fontSize(14).font("Helvetica-Bold").text("OFFICIAL CIVIC ISSUE REPORT", 300, 50, { align: "right" });
      const formattedDateStr = new Date().toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
      });
      doc.fillColor(lightText).fontSize(8).font("Helvetica").text(`Report Generated: ${formattedDateStr}`, 300, 68, { align: "right" });

      // Header Divider
      doc.moveTo(50, 85).lineTo(545, 85).stroke(borderCol);

      // --- SECTION 1: ISSUE INFORMATION ---
      doc.fillColor(primaryColor).fontSize(11).font("Helvetica-Bold").text("1. ISSUE GENERAL INFORMATION", 50, 100);
      
      // Metadata Table/Box
      const tableTop = 120;
      const col1 = 50;
      const col2 = 180;
      const col3 = 300;
      const col4 = 420;

      // Background for Metadata Grid
      doc.rect(50, tableTop, 495, 110).fillAndStroke(lightBg, borderCol);

      // Grid details
      doc.fillColor(darkText).fontSize(8).font("Helvetica-Bold");
      
      // Row 1
      doc.text("Issue ID:", col1 + 10, tableTop + 10);
      doc.text("Status:", col3 + 10, tableTop + 10);
      // Row 2
      doc.text("Title:", col1 + 10, tableTop + 30);
      doc.text("Category:", col3 + 10, tableTop + 30);
      // Row 3
      doc.text("Severity:", col1 + 10, tableTop + 50);
      doc.text("Priority Score:", col3 + 10, tableTop + 50);
      // Row 4
      doc.text("Department:", col1 + 10, tableTop + 70);
      doc.text("Created At:", col3 + 10, tableTop + 70);
      // Row 5
      doc.text("Location:", col1 + 10, tableTop + 90);

      // Values in Grid
      doc.fillColor(secondaryColor).font("Helvetica");
      // Row 1
      doc.text(issueData.id || "N/A", col1 + 80, tableTop + 10);
      const statusLabel = issueData.status ? issueData.status.toUpperCase() : "REPORTED";
      doc.font("Helvetica-Bold").text(statusLabel, col3 + 90, tableTop + 10);
      doc.font("Helvetica");
      // Row 2
      doc.text(issueData.title || "Untitled Civic Issue", col1 + 80, tableTop + 30, { width: 110, height: 15, ellipsis: true });
      doc.text(issueData.category || "General", col3 + 90, tableTop + 30);
      // Row 3
      doc.text((issueData.severity || "medium").toUpperCase(), col1 + 80, tableTop + 50);
      doc.text(String(issueData.priorityScore || 0), col3 + 90, tableTop + 50);
      // Row 4
      doc.text(issueData.recommendedDepartment || "Pending Assignment", col1 + 80, tableTop + 70);
      
      const createdAtDate = issueData.createdAt && typeof issueData.createdAt.toDate === "function"
        ? issueData.createdAt.toDate()
        : new Date(issueData.createdAt || Date.now());
      const formattedCreated = createdAtDate.toLocaleString("en-IN", {
        day: "numeric", month: "short", year: "numeric"
      });
      doc.text(formattedCreated, col3 + 90, tableTop + 70);

      // Row 5
      const addressStr = issueData.location?.address || "Coordinate Area";
      doc.text(addressStr, col1 + 80, tableTop + 90, { width: 390, height: 15, ellipsis: true });

      // --- SECTION 2: EVIDENCE & INTAKE ---
      const section2Top = 245;
      doc.fillColor(primaryColor).fontSize(11).font("Helvetica-Bold").text("2. PHYSICAL EVIDENCE & AI INTAKE", 50, section2Top);

      // Draw Image (Left side) and Description (Right side)
      const imgX = 50;
      const imgY = section2Top + 20;
      const imgW = 200;
      const imgH = 150;

      if (imageBuffer) {
        try {
          doc.image(imageBuffer, imgX, imgY, { width: imgW, height: imgH, fit: [imgW, imgH], align: "center", valign: "center" });
          // Border around image
          doc.rect(imgX, imgY, imgW, imgH).stroke(borderCol);
        } catch (err) {
          // Fallback if image load fails
          doc.rect(imgX, imgY, imgW, imgH).fillAndStroke(lightBg, borderCol);
          doc.fillColor(lightText).fontSize(8).font("Helvetica-Oblique").text("Original Evidence Image (Display unavailable)", imgX + 10, imgY + 60, { width: imgW - 20, align: "center" });
        }
      } else {
        doc.rect(imgX, imgY, imgW, imgH).fillAndStroke(lightBg, borderCol);
        doc.fillColor(lightText).fontSize(8).font("Helvetica-Oblique").text("No physical evidence image attached.", imgX + 10, imgY + 60, { width: imgW - 20, align: "center" });
      }

      // Right side text
      const textX = 270;
      const textY = section2Top + 20;
      const textW = 275;

      doc.fillColor(darkText).fontSize(9).font("Helvetica-Bold").text("Citizen Description:", textX, textY);
      const descText = issueData.description || "No description provided.";
      doc.fillColor(secondaryColor).font("Helvetica").text(descText, textX, textY + 12, { width: textW, height: 50, ellipsis: true });

      doc.fillColor(darkText).fontSize(9).font("Helvetica-Bold").text("AI Intake Summary:", textX, textY + 70);
      const summaryText = issueData.summary || "AI summary not processed.";
      doc.fillColor(secondaryColor).font("Helvetica").text(summaryText, textX, textY + 82, { width: textW, height: 50, ellipsis: true });

      // Visual Evidence Bullet points
      const visY = section2Top + 185;
      doc.fillColor(darkText).fontSize(9).font("Helvetica-Bold").text("Visual Evidence Detected by Ingestion Agent:", 50, visY);
      const bullets = issueData.visualEvidence || [];
      let bulletY = visY + 14;
      doc.fillColor(secondaryColor).font("Helvetica").fontSize(8.5);
      if (bullets.length > 0) {
        bullets.slice(0, 3).forEach((b: string) => {
          doc.text(`• ${b}`, 60, bulletY, { width: 480 });
          bulletY += 12;
        });
      } else {
        doc.text("• No visual anomalies explicitly identified.", 60, bulletY);
      }

      // FOOTER PAGE 1
      doc.fillColor(lightText).fontSize(7).font("Helvetica")
        .text("Awaaz Civic Accountability Platform | Technical Case Audit", 50, 780, { align: "left" })
        .text("Page 1 of 2", 300, 780, { align: "right" });

      // --- ADD PAGE 2 ---
      doc.addPage();

      // Header Page 2
      doc.fillColor(primaryColor).fontSize(20).font("Helvetica-Bold").text("AWAAZ", 50, 50);
      doc.fillColor(accentColor).fontSize(8).font("Helvetica-Bold").text("CIVIC ACCOUNTABILITY PLATFORM", 50, 72);
      doc.fillColor(primaryColor).fontSize(14).font("Helvetica-Bold").text("OFFICIAL CIVIC ISSUE REPORT", 300, 50, { align: "right" });
      doc.fillColor(lightText).fontSize(8).font("Helvetica").text(`Issue ID: ${issueData.id || "N/A"}`, 300, 68, { align: "right" });
      doc.moveTo(50, 85).lineTo(545, 85).stroke(borderCol);

      // --- SECTION 3: COMMUNITY INTELLIGENCE ---
      doc.fillColor(primaryColor).fontSize(11).font("Helvetica-Bold").text("3. COMMUNITY AGENT BRIEF & ADVISORY ANALYSIS", 50, 100);

      const ca = issueData.communityAnalysis || {};

      // Background for Analysis Brief
      const briefBoxY = 120;
      doc.rect(50, briefBoxY, 495, 95).fillAndStroke(lightBg, borderCol);

      doc.fillColor(darkText).fontSize(9).font("Helvetica-Bold").text("Executive Brief:", 60, briefBoxY + 10);
      doc.fillColor(secondaryColor).font("Helvetica").fontSize(8.5);
      const briefText = ca.brief || "No community briefing compiled yet.";
      doc.text(briefText, 60, briefBoxY + 22, { width: 475, height: 65, ellipsis: true });

      // Report Summary - Added in Phase 1
      const reportSummaryBoxY = 225;
      doc.rect(50, reportSummaryBoxY, 495, 75).fillAndStroke(lightBg, borderCol);
      doc.fillColor(darkText).fontSize(9).font("Helvetica-Bold").text("Official Report Summary (Advisory):", 60, reportSummaryBoxY + 10);
      doc.fillColor(secondaryColor).font("Helvetica").fontSize(8.5);
      const reportSummaryText = ca.reportSummary || ca.brief || "No official report summary compiled yet.";
      doc.text(reportSummaryText, 60, reportSummaryBoxY + 22, { width: 475, height: 45, ellipsis: true });

      // Key Insights & Possible Factors Columns
      const intelligenceY = 310;
      const colW = 235;
      
      doc.fillColor(darkText).fontSize(9).font("Helvetica-Bold").text("Key Insights from Citizens:", 50, intelligenceY);
      const insights = ca.keyInsights || [];
      let insightY = intelligenceY + 14;
      doc.fillColor(secondaryColor).font("Helvetica").fontSize(8);
      if (insights.length > 0) {
        insights.slice(0, 4).forEach((insight: string) => {
          doc.text(`• ${insight}`, 60, insightY, { width: colW - 20, height: 24, ellipsis: true });
          insightY += 20;
        });
      } else {
        doc.text("• No recurring citizen observations registered.", 60, insightY);
      }

      doc.fillColor(darkText).fontSize(9).font("Helvetica-Bold").text("Inferred Contributing Factors:", 300, intelligenceY);
      const factors = ca.possibleFactors || [];
      let factorY = intelligenceY + 14;
      doc.fillColor(secondaryColor).font("Helvetica").fontSize(8);
      if (factors.length > 0) {
        factors.slice(0, 4).forEach((factor: string) => {
          doc.text(`• ${factor}`, 310, factorY, { width: colW - 20, height: 24, ellipsis: true });
          factorY += 20;
        });
      } else {
        doc.text("• Insufficient context to identify possible factors.", 310, factorY);
      }

      // Recommended next step, Mood & Urgency
      const nextY = 415;
      doc.rect(50, nextY, 495, 55).fillAndStroke(lightBg, borderCol);
      
      doc.fillColor(darkText).fontSize(8.5).font("Helvetica-Bold").text("Recommended Operational Next Step:", 60, nextY + 10);
      const nextStep = ca.recommendedNextStep || "Verify reported damage on-site and assess resource requirements.";
      doc.fillColor(secondaryColor).font("Helvetica").fontSize(8).text(nextStep, 60, nextY + 22, { width: 475 });

      doc.fillColor(darkText).fontSize(8).font("Helvetica-Bold").text("Community Mood: ", 60, nextY + 38);
      const moodStr = (ca.communityMood || "neutral").toUpperCase();
      doc.fillColor(accentColor).fontSize(8).text(moodStr, 140, nextY + 38);

      doc.fillColor(darkText).fontSize(8).font("Helvetica-Bold").text("Urgency Alert Note: ", 240, nextY + 38);
      const urgencyAlert = ca.urgencyNote || "No urgent flags raised.";
      doc.fillColor(secondaryColor).fontSize(8).text(urgencyAlert, 335, nextY + 38, { width: 200, height: 12, ellipsis: true });

      // --- SECTION 4: COMMUNITY PARTICIPATION & DNA ---
      const partY = 485;
      doc.fillColor(primaryColor).fontSize(11).font("Helvetica-Bold").text("4. CITIZEN ENGAGEMENT METRICS & ISSUE DNA", 50, partY);

      const metricsBoxY = partY + 15;
      doc.rect(50, metricsBoxY, 495, 45).fillAndStroke(lightBg, borderCol);

      // Metrics Row
      const mColW = 495 / 4;
      doc.fillColor(darkText).fontSize(8).font("Helvetica-Bold");
      doc.text("Endorsements", 50 + 10, metricsBoxY + 10, { width: mColW, align: "center" });
      doc.text("Duplicate Reports", 50 + mColW + 10, metricsBoxY + 10, { width: mColW, align: "center" });
      doc.text("Verifications", 50 + (mColW * 2) + 10, metricsBoxY + 10, { width: mColW, align: "center" });
      doc.text("Comments Posted", 50 + (mColW * 3) + 10, metricsBoxY + 10, { width: mColW, align: "center" });

      doc.fillColor(primaryColor).fontSize(12).font("Helvetica-Bold");
      doc.text(String(issueData.endorsementCount || 0), 50 + 10, metricsBoxY + 24, { width: mColW, align: "center" });
      const duplicateCountVal = issueData.duplicateReports ?? issueData.dna?.duplicateReports ?? issueData.duplicateCount ?? 0;
      doc.text(String(duplicateCountVal), 50 + mColW + 10, metricsBoxY + 24, { width: mColW, align: "center" });
      const verifyCountVal = issueData.dna?.verificationCount ?? 0;
      doc.text(String(verifyCountVal), 50 + (mColW * 2) + 10, metricsBoxY + 24, { width: mColW, align: "center" });
      doc.text(String(comments.length), 50 + (mColW * 3) + 10, metricsBoxY + 24, { width: mColW, align: "center" });

      // Issue DNA
      const dnaY = metricsBoxY + 55;
      doc.fillColor(darkText).fontSize(9).font("Helvetica-Bold").text("Issue DNA Analysis Profile:", 50, dnaY);
      doc.fillColor(secondaryColor).font("Helvetica").fontSize(8);
      const dna = issueData.dna || {};
      const velocityStr = dna.endorsementVelocity !== undefined ? String(dna.endorsementVelocity) : "0";
      const reopenStr = dna.reopenCount !== undefined ? String(dna.reopenCount) : "0";
      doc.text(`• Endorsement Sign-off Velocity: ${velocityStr} signatures/day`, 60, dnaY + 14);
      doc.text(`• Issue Reopen Incidents: ${reopenStr} events`, 60, dnaY + 24);
      doc.text(`• Case Ingestion Confidence Engine Rating: ${(issueData.confidence || 0).toFixed(2)}`, 280, dnaY + 14);
      doc.text(`• Initial Priority Ranking Metric: ${issueData.priorityScore || 0}`, 280, dnaY + 24);

      // --- SECTION 5: RESOLUTION STATUS & AUDIT PATHWAY ---
      const resY = partY + 155;
      doc.fillColor(primaryColor).fontSize(11).font("Helvetica-Bold").text("5. RESOLUTION AUDIT & TRUTH ENGINE INTEGRATION", 50, resY);

      const resBoxY = resY + 15;
      doc.rect(50, resBoxY, 495, 60).fillAndStroke(lightBg, borderCol);

      if (issueData.status !== "resolved") {
        doc.fillColor(darkText).fontSize(10).font("Helvetica-Bold").text("Pending Resolution", 60, resBoxY + 15);
        doc.fillColor(lightText).font("Helvetica").fontSize(8).text("This civic issue is currently in the active operational lifecycle. Standard resolution workflows are pending formal site verification, departmental sign-off, and local citizen auditing.", 60, resBoxY + 28, { width: 475 });
      } else {
        if (issueData.resolution) {
          doc.fillColor(darkText).fontSize(9).font("Helvetica-Bold").text("Resolved & Signed Off", 60, resBoxY + 8);
          
          const resolvedByStr = issueData.resolution.resolvedBy || "Administrator";
          const resolvedAtStr = issueData.resolution.resolvedAt 
            ? new Date(issueData.resolution.resolvedAt).toLocaleDateString("en-IN", {
                day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
              })
            : "N/A";
          
          doc.fillColor(secondaryColor).fontSize(7.5).font("Helvetica")
            .text(`Resolved By: ${resolvedByStr}   |   Resolved Date: ${resolvedAtStr}`, 60, resBoxY + 20);
          
          doc.fillColor(darkText).fontSize(8).font("Helvetica-Oblique")
            .text(`Resolution Note: "${issueData.resolution.resolutionNote || 'No resolution note provided.'}"`, 60, resBoxY + 32, { width: 475, height: 24, ellipsis: true });
        } else {
          doc.fillColor(darkText).fontSize(10).font("Helvetica-Bold").text("Resolved [Audit Verification Pending]", 60, resBoxY + 10);
          doc.fillColor(lightText).font("Helvetica").fontSize(8).text("No resolution evidence available. Final resolution validation pending community-led truth verification audit. Citizen-driven inspection protocols, photographic evidence confirmation, and cryptographic ledger verification remain queued.", 60, resBoxY + 22, { width: 475 });
        }
      }

      // If truthAnalysis is present, let's put signatures on Page 3 instead. Otherwise on Page 2.
      const hasTruth = !!issueData.truthAnalysis;

      if (!hasTruth) {
        // Sign-off signature fields
        const sigY = 715;
        doc.moveTo(50, sigY).lineTo(220, sigY).stroke(borderCol);
        doc.moveTo(375, sigY).lineTo(545, sigY).stroke(borderCol);

        doc.fillColor(lightText).fontSize(7).font("Helvetica");
        doc.text("Municipal Department Audit Officer", 50, sigY + 5, { width: 170, align: "center" });
        doc.text("Awaaz Civic Network Validator", 375, sigY + 5, { width: 170, align: "center" });

        // FOOTER PAGE 2
        doc.fillColor(lightText).fontSize(7).font("Helvetica")
          .text("Awaaz Civic Accountability Platform | Technical Case Audit", 50, 780, { align: "left" })
          .text("Page 2 of 2", 300, 780, { align: "right" });
      } else {
        // FOOTER PAGE 2 (without signatures)
        doc.fillColor(lightText).fontSize(7).font("Helvetica")
          .text("Awaaz Civic Accountability Platform | Technical Case Audit", 50, 780, { align: "left" })
          .text("Page 2 of 3", 300, 780, { align: "right" });

        // --- ADD PAGE 3 ---
        doc.addPage();

        // Header Page 3
        doc.fillColor(primaryColor).fontSize(20).font("Helvetica-Bold").text("AWAAZ", 50, 50);
        doc.fillColor(accentColor).fontSize(8).font("Helvetica-Bold").text("CIVIC ACCOUNTABILITY PLATFORM", 50, 72);
        doc.fillColor(primaryColor).fontSize(14).font("Helvetica-Bold").text("OFFICIAL CIVIC ISSUE REPORT", 300, 50, { align: "right" });
        doc.fillColor(lightText).fontSize(8).font("Helvetica").text(`Issue ID: ${issueData.id || "N/A"}`, 300, 68, { align: "right" });
        doc.moveTo(50, 85).lineTo(545, 85).stroke(borderCol);

        // --- SECTION 6: TRUTH ENGINE INDEPENDENT VERIFICATION ---
        doc.fillColor(primaryColor).fontSize(11).font("Helvetica-Bold").text("6. TRUTH ENGINE INDEPENDENT AUDIT VERIFICATION", 50, 100);

        const ta = issueData.truthAnalysis;

        // Big Status Box
        const statusBoxY = 120;
        doc.rect(50, statusBoxY, 495, 60).fillAndStroke(lightBg, borderCol);

        doc.fillColor(darkText).fontSize(9).font("Helvetica-Bold").text("Verification Status:", 65, statusBoxY + 15);
        const statusVal = ta.verificationStatus || "Needs Review";
        doc.fillColor(accentColor).fontSize(14).font("Helvetica-Bold").text(statusVal.toUpperCase(), 65, statusBoxY + 28);

        doc.fillColor(darkText).fontSize(9).font("Helvetica-Bold").text("Verification Confidence:", 300, statusBoxY + 15);
        const confPct = Math.round((ta.confidence || 0) * 100);
        doc.fillColor(primaryColor).fontSize(14).font("Helvetica-Bold").text(`${confPct}%`, 300, statusBoxY + 28);

        // Executive Summary
        const summaryBoxY = 195;
        doc.rect(50, summaryBoxY, 495, 110).fillAndStroke(lightBg, borderCol);

        doc.fillColor(darkText).fontSize(9).font("Helvetica-Bold").text("Truth Audit Executive Summary:", 65, summaryBoxY + 12);
        doc.fillColor(secondaryColor).font("Helvetica").fontSize(8.5);
        const truthSummaryText = ta.verificationSummary || "No truth verification summary compiled yet.";
        doc.text(truthSummaryText, 65, summaryBoxY + 26, { width: 465, height: 75, ellipsis: true });

        // Operational Recommendation
        const recBoxY = 320;
        doc.rect(50, recBoxY, 495, 55).fillAndStroke(lightBg, borderCol);

        doc.fillColor(darkText).fontSize(9).font("Helvetica-Bold").text("Independent Operational Recommendation:", 65, recBoxY + 10);
        const recText = ta.recommendation || "Monitor citizen feedback.";
        doc.fillColor(secondaryColor).font("Helvetica").fontSize(8.5).text(recText, 65, recBoxY + 24, { width: 465 });

        // Visual Assessment & Warnings
        const detailY = 390;
        doc.fillColor(darkText).fontSize(9).font("Helvetica-Bold").text("Independent Visual Observations & Warnings:", 50, detailY);
        
        doc.fillColor(secondaryColor).font("Helvetica").fontSize(8);
        doc.text(`• Visual Observation: ${ta.visualAssessment || "No direct physical observations logged."}`, 60, detailY + 15, { width: 480 });

        const concerns = ta.remainingConcerns || [];
        let concernY = detailY + 30;
        if (concerns.length > 0) {
          doc.fillColor(darkText).font("Helvetica-Bold").fontSize(8.5).text("Factual Anomalies / Potential Alerts:", 60, concernY);
          concernY += 12;
          doc.fillColor(secondaryColor).font("Helvetica").fontSize(8);
          concerns.slice(0, 3).forEach((c: string) => {
            doc.text(`• ${c}`, 70, concernY, { width: 460 });
            concernY += 12;
          });
        }

        // Signatures at bottom of Page 3
        const sigY = 715;
        doc.moveTo(50, sigY).lineTo(220, sigY).stroke(borderCol);
        doc.moveTo(375, sigY).lineTo(545, sigY).stroke(borderCol);

        doc.fillColor(lightText).fontSize(7).font("Helvetica");
        doc.text("Municipal Department Audit Officer", 50, sigY + 5, { width: 170, align: "center" });
        doc.text("Awaaz Civic Network Validator", 375, sigY + 5, { width: 170, align: "center" });

        // FOOTER PAGE 3
        doc.fillColor(lightText).fontSize(7).font("Helvetica")
          .text("Awaaz Civic Accountability Platform | Technical Case Audit", 50, 780, { align: "left" })
          .text("Page 3 of 3", 300, 780, { align: "right" });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
