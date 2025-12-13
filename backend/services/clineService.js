const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);
const dotenv = require("dotenv");
const axios = require("axios");
const path = require("path");
const githubAppService = require("./githubAppService");

dotenv.config({ path: path.join(__dirname, "../.env") });

class ClineService {

  async analyzePRDiff(prUrl, installationId) {
    try {
      const diffUrl = prUrl.endsWith(".diff") ? prUrl : `${prUrl}.diff`;
      console.log(`Fetching diff from: ${diffUrl}`);

      const diff = await this.fetchPRDiff(diffUrl, installationId);
      if (!diff || diff.trim().length === 0) {
        throw new Error("Failed to fetch PR diff or PR is empty");
      }

      console.log(`Fetched ${diff.length} characters of diff data`);

      const analysisPrompt = `Analyze this code diff and provide ONLY the following analysis.
Do not include any conversation, thinking, or explanation.
Output ONLY these exact lines (fill in the values):

SCORE: <number 0-100>
RISK: <LOW|MEDIUM|HIGH>
ISSUES:
- file=<relative file path> snippet=<exact code line from diff> reason=<issue description>
- file=<relative file path> snippet=<exact code line from diff> reason=<issue description>
RECOMMENDATIONS:
- <recommendation 1>
- <recommendation 2>

Rules:
- Do NOT include line numbers
- The snippet must be the exact code line from the diff (trimmed, no + or - prefix)
- Include file path, code snippet, and reason for each issue`;

      const fs = require("fs");
      const tempFile = `temp_diff_${Date.now()}.txt`;
      fs.writeFileSync(tempFile, diff);

      const clineCommand = `type "${tempFile}" | cline -y "${analysisPrompt}"`;
      const { stdout: analysis } = await execPromise(clineCommand);

      fs.unlinkSync(tempFile);

      console.log("Analysis completed");
      console.log(analysis);

      const parsed = this.parseCleanAnalysis(analysis);
      
      // Parsinf diff to get correct line numbers
      const diffMap = this.parseUnifiedDiff(diff);
      
      const issues = this.findLineBySnippet(parsed.issuesData || [], diffMap);
      
      return {
        score: parsed.score,
        riskLevel: parsed.riskLevel,
        issues,
        recommendations: parsed.recommendations
      };
    } catch (error) {
      console.error("Analysis error:", error.message);
      throw new Error(`PR analysis failed: ${error.message}`);
    }
  }

  parseCleanAnalysis(output) {
    console.log('Parsing clean Cline output...');
    console.log("Raw output")
    console.log("===================")
    console.log(output)
    console.log("Raw output finished")
   

    const scoreMatch = output.match(/SCORE:\s*(\d+)/i);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : null;
    
    const riskMatch = output.match(/RISK:\s*(LOW|MEDIUM|HIGH)/i);
    const riskLevel = riskMatch ? riskMatch[1].toUpperCase() : null;
    
    // Helper: find last occurrence of a section header (case-insensitive)
    const ci = (s) => s.toUpperCase();
    const findLastHeaderIndex = (text, header) => ci(text).lastIndexOf(ci(header));

    // Extract structured issues: file, snippet, reason
    const issuesData = [];
    const issuesHeaderIdx = findLastHeaderIndex(output, 'ISSUES:');
    if (issuesHeaderIdx >= 0) {
      const afterIssues = output.slice(issuesHeaderIdx + 'ISSUES:'.length);
      const nextRecIdxLocal = ci(afterIssues).indexOf(ci('RECOMMENDATIONS:'));
      const issuesBlock = nextRecIdxLocal >= 0 ? afterIssues.slice(0, nextRecIdxLocal) : afterIssues;
      const issueLines = issuesBlock.matchAll(/^\s*[\-•*]\s+(.+)$/gm);
      
      for (const m of issueLines) {
        const line = m[1].trim().replace(/\r$/, '');
        if (line.length <= 3 || /[<>]/.test(line)) continue;
        
        // Parse: file=<path> snippet=<code> reason=<msg>
        const fileMatch = line.match(/file=([^\s]+)/);
        const snippetMatch = line.match(/snippet=(.+?)\s+reason=/);
        const reasonMatch = line.match(/reason=(.+)$/);
        
        if (fileMatch && snippetMatch && reasonMatch) {
          issuesData.push({
            file: fileMatch[1].trim(),
            snippet: snippetMatch[1].trim(),
            reason: reasonMatch[1].trim()
          });
        }
      }
    }
    
    // Extract recommendations from the LAST RECOMMENDATIONS section
    const recommendations = [];
    const recHeaderIdx = findLastHeaderIndex(output, 'RECOMMENDATIONS:');
    if (recHeaderIdx >= 0) {
      const afterRec = output.slice(recHeaderIdx + 'RECOMMENDATIONS:'.length);
      const lines = afterRec.split(/\r?\n/);
      for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;
        const m = line.match(/^[\-•*]\s+(.+)$/);
        if (m) {
          const rec = m[1].trim();
          if (rec.length > 3 && !/[<>]/.test(rec)) {
            recommendations.push(rec);
          }
        } else {
          break;
        }
      }
    }
    
    return {
      score,
      riskLevel,
      issuesData,
      recommendations,
    };
  }

  // Parse unified diff to build line number map
  parseUnifiedDiff(diffText) {
    const files = new Map();
    const lines = diffText.split(/\r?\n/);
    let currentFile = null;
    let newLine = 0;
    
    for (const line of lines) {
      // Track current file from diff header
      if (line.startsWith('+++ ')) {
        const path = line.slice(4).trim();
        if (path === '/dev/null') {
          currentFile = null;
          continue;
        }
        currentFile = path.replace(/^[ab]\//, '');
        if (!files.has(currentFile)) {
          files.set(currentFile, { lines: [] });
        }
        continue;
      }
      
      const hunk = line.match(/^@@\s+-.+\s+\+(\d+)/);
      if (hunk) {
        newLine = parseInt(hunk[1], 10) - 1;
        continue;
      }
      
      if (!currentFile || !files.has(currentFile)) continue;

      if (line.startsWith('+') && !line.startsWith('+++')) {
        newLine++;
        files.get(currentFile).lines.push({ line: newLine, content: line.slice(1) });
      }  
      else if (line.startsWith(' ')) {
        newLine++;
        files.get(currentFile).lines.push({ line: newLine, content: line.slice(1) });
      }

    }
    
    return files;
  }

  // Find exact line number by matching code snippet in diff
  findLineBySnippet(issuesData, diffMap) {
    const issues = [];
    
    for (const issue of issuesData) {
      const normalizedPath = issue.file.trim().replace(/^[ab]\//, '');
      
      // Find matching file in diff
      let matchedFile = null;
      for (const [diffFile] of diffMap) {
        if (diffFile === normalizedPath || diffFile.endsWith('/' + normalizedPath) || normalizedPath.endsWith('/' + diffFile)) {
          matchedFile = diffFile;
          break;
        }
      }
      
      if (matchedFile && diffMap.has(matchedFile)) {
        const fileData = diffMap.get(matchedFile);
        // Normalize whitespace for better matching
        const snippetNormalized = issue.snippet.trim().replace(/\s+/g, ' ');
        
        // Try exact match first
        let foundLine = fileData.lines.find(l => {
          const contentNormalized = l.content.trim().replace(/\s+/g, ' ');
          return contentNormalized === snippetNormalized;
        });
        
        // If not found, try contains match
        if (!foundLine) {
          foundLine = fileData.lines.find(l => {
            const content = l.content.trim();
            return content.includes(snippetNormalized) || snippetNormalized.includes(content);
          });
        }
        
        if (foundLine) {
          issues.push(`${matchedFile}:${foundLine.line} - ${issue.reason}`);
          console.log(`✓ Matched "${snippetNormalized.slice(0, 40)}..." → ${matchedFile}:${foundLine.line}`);
        } else {
          issues.push(`${matchedFile} - ${issue.reason} (line not found)`);
          console.warn(`✗ Could not match: "${snippetNormalized.slice(0, 40)}..."`);
        }
      } else {
        issues.push(`${issue.file} - ${issue.reason} (file not in diff)`);
      }
    }
    
    return issues;
  }

  parseAnalysis(rawAnalysis) {
    console.log('Parsing analysis...');
    
    const summaryMatch = rawAnalysis.match(
      /Analysis Summary:\s*([\s\S]*?)(?:##|\*Conversation|$)/i
    );
    
    if (!summaryMatch) {
      console.warn('No Analysis Summary found in output');
      return {
        score: null,
        riskLevel: null,
        issues: [],
        recommendations: [],
        raw: rawAnalysis,
      };
    }
    
    const summaryText = summaryMatch[1].trim();
    console.log('Extracted summary section:', summaryText.substring(0, 300));
    
    // Use flexible patterns that work with various formats
    const qualityScore = summaryText.match(
      /(?:quality\s+score|score)\s*:\s*(\d+)/i
    )?.[1];
    
    // Match: "Risk: LOW" or "Risk : LOW" or "Risk Level: LOW" etc.
    const riskLevel = summaryText.match(
      /(?:risk\s+level|risk)\s*:\s*(LOW|MEDIUM|HIGH)/i
    )?.[1];

    console.log('Extracted - Score:', qualityScore, 'Risk:', riskLevel);

    // Extract issues - look within the summary section only
    const issuesMatch = summaryText.match(
      /specific\s+issues[^:]*:([\s\S]*?)(?:-\s*actionable\s+recommendations|$)/i
    );
    let issues = [];
    if (issuesMatch) {
      console.log('Found issues section, extracting...');
      const issuesText = issuesMatch[1];
      const issueMatches = issuesText.matchAll(/^\s*-\s*(.+)/gm);
      for (const match of issueMatches) {
        const issue = match[1].trim();
        // Skip template placeholders and short entries
        if (issue.length > 10 && 
            !issue.includes('<issue') && 
            !issue.includes('Actionable recommendations')) {
          issues.push(issue);
          console.log('Extracted issue:', issue.substring(0, 80));
        }
      }
    }
    console.log(`Found ${issues.length} issues`);

    // Extract recommendations - look within the summary section only
    const recommendationsMatch = summaryText.match(
      /actionable\s+recommendations[^:]*:([\s\S]*?)$/i
    );
    let recommendations = [];
    if (recommendationsMatch) {
      console.log('Found recommendations section, extracting...');
      const recsText = recommendationsMatch[1];
      const recMatches = recsText.matchAll(/^\s*-\s*(.+)/gm);
      for (const match of recMatches) {
        const rec = match[1].trim();
        if (rec.length > 10 && 
            !rec.includes('<recommendation') &&
            !rec.includes('##') &&
            !rec.includes('API request') &&
            !rec.includes('Checkpoint created')) {
          recommendations.push(rec);
          console.log('Extracted recommendation:', rec.substring(0, 80));
        }
      }
    }
    console.log(`Found ${recommendations.length} recommendations`);

    return {
      score: qualityScore ? parseInt(qualityScore) : null,
      riskLevel: riskLevel?.toUpperCase() || null,
      issues: issues,
      recommendations: recommendations,
      raw: rawAnalysis,
    };
  }

  // Not in use
  parseAnalysis_old(rawAnalysis) {
    return {
      raw: rawAnalysis.trim(),
      qualityScore: this.extractScore(rawAnalysis) || 75,
      riskLevel: this.extractRisk(rawAnalysis) || "MEDIUM",
      issues: this.extractIssues(rawAnalysis),
      timestamp: new Date().toISOString(),
    };
  }

  extractScore(text) {
    const match = text.match(/score[:\s]+(\d+)/i);
    return match ? parseInt(match[1]) : null;
  }

  extractRisk(text) {
    const riskMatch = text.match(/(LOW|MEDIUM|HIGH)/i);
    return riskMatch ? riskMatch[1].toUpperCase() : null;
  }

  extractIssues(text) {
    const lines = text.split("\n");
    return lines
      .filter(
        (line) => line.trim().startsWith("-") || line.trim().startsWith("*")
      )
      .map((line) => line.trim().replace(/^[-*]\s*/, ""));
  }

  parsePRUrl(prUrl) {
    const match = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);

    if (!match) throw new Error("Invalid PR URL");

    return {
      owner: match[1],
      repo: match[2],
      prNumber: match[3],
    };
  }

  async fetchPRDiff(url, installationId) {
    const githubAppService = require("./githubAppService");
    let pr = this.parsePRUrl(url);
    console.log("Fetching PR diff:", pr);

    // Get installation token for this specific installation
    const token = await githubAppService.getInstallationToken(installationId);

    const res = await axios.get(
      `https://api.github.com/repos/${pr.owner}/${pr.repo}/pulls/${pr.prNumber}`,
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3.diff",
        },
      }
    );

    return res.data;
  }
}

module.exports = new ClineService();

// let url = "https://github.com/sudhanshu-raj/sample-repo/pull/5"
// new ClineService().analyzePRDiff(url, "98952518")  cd
