const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const githubAppService = require('../services/githubAppService');

function verifyGitHubSignature(payload, signature, secret) {
    if (!signature) return false;
    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

// GitHub webhook endpoint
router.post('/', async (req, res) => {
    console.log('WEBHOOK RECEIVED');
    console.log('Headers:', req.headers);
    
    const signature = req.headers['x-hub-signature-256'];
    const event = req.headers['x-github-event'];
    const payload = JSON.stringify(req.body);

    if (!verifyGitHubSignature(payload, signature, process.env.GITHUB_WEBHOOK_SECRET)) {
        return res.status(401).json({ error: 'Invalid signature' });
    }

    console.log(`Received GitHub event: ${event}`);

    if (event === 'pull_request') {
        const action = req.body.action;
        const pr = req.body.pull_request;
        const installation = req.body.installation;
        const repo = req.body.repository;

        console.log(`\nPR Event: ${action} on ${repo.full_name}#${pr.number}`);

        if (['opened', 'synchronize', 'reopened'].includes(action)) {
            const executionId = `exec-${Date.now()}`;
            
            res.json({
                message: 'Analysis triggered',
                executionId,
                event,
                pr: pr.number
            });

            // Process analysis asynchronously
            (async () => {
                const clineService = require('../services/clineService');
                let checkRunId = null;
                
                try {
                    console.log(`Creating check run for PR #${pr.number}...`);
                    
                    // Create check run
                    const checkRun = await githubAppService.createCheckRun(
                        installation.id,
                        repo.owner.login,
                        repo.name,
                        {
                            name: 'RevBot  Review',
                            head_sha: pr.head.sha,
                            status: 'in_progress',
                            started_at: new Date().toISOString(),
                            output: {
                                title: 'Code Review in Progress',
                                summary: 'AI is analyzing your code changes...'
                            }
                        }
                    );
                    
                    checkRunId = checkRun.id;
                    console.log(`Check run created: ${checkRunId}`);

                    console.log(`Starting Cline analysis for ${pr.html_url}...`);
                    const result = await clineService.analyzePRDiff(pr.html_url, installation.id);
                    console.log(`Analysis complete - Score: ${result.score}, Risk: ${result.riskLevel}`);
                    
                    global.analysisResults = global.analysisResults || {};
                    global.analysisResults[executionId] = {
                        executionId,
                        status: 'completed',
                        results: result,
                        prUrl: pr.html_url,
                        repository: repo.full_name,
                        prNumber: pr.number,
                        installation: installation.id,
                        checkRunId
                    };

                    const conclusion = result.riskLevel === 'HIGH' ? 'failure' : 
                                      result.riskLevel === 'MEDIUM' ? 'neutral' : 'success';

                    const issueList = result.issues.slice(0, 10).map((issue, i) => `${i + 1}. ${issue}`).join('\n');
                    const recommendations = result.recommendations.slice(0, 10).map((recommendation, i) => `${i + 1}. ${recommendation}`).join('\n');
                    const summary = `**Quality Score:** ${result.score}/100\n**Risk Level:** ${result.riskLevel}\n\n### Issues Found:\n${issueList || 'No major issues detected'}\n\n### Recommendations:\n${recommendations || 'No recommendations needed'}`;

                    console.log("Summary going to print::"+summary)

                    console.log(`Updating check run with ${conclusion}...`);
                    await githubAppService.updateCheckRun(
                        installation.id,
                        repo.owner.login,
                        repo.name,
                        checkRunId,
                        {
                            status: 'completed',
                            conclusion,
                            completed_at: new Date().toISOString(),
                            output: {
                                title: `Code Review Complete - ${conclusion.toUpperCase()}`,
                                summary,
                                // text: result.raw
                            }
                        }
                    );

                    // Parse issues to extract file paths and line numbers for inline comments
                    const reviewComments = [];
                    for (const issue of result.issues) {
                        // Expected format: "src/server.js:26 - Incorrect HTTP status code..."
                        const match = issue.match(/^(.+?):(\d+)\s*-\s*(.+)$/);
                        if (match) {
                            const [, path, line, message] = match;
                            reviewComments.push({
                                path: path.trim(),
                                line: parseInt(line),
                                body: `⚠️ ${message.trim()}`
                            });
                        }
                    }

                    // Create inline review if we have comments with line numbers
                    if (reviewComments.length > 0) {
                        console.log(`Creating review with ${reviewComments.length} inline comments...`);
                        try {
                            await githubAppService.createReview(
                                installation.id,
                                repo.owner.login,
                                repo.name,
                                pr.number,
                                pr.head.sha,
                                reviewComments,
                                'COMMENT'
                            );
                            console.log(`Inline review posted successfully`);
                            
                            // Also post summary comment with score and recommendations
                            const commentBody = `## 🤖 RevBot Review Results\n\n${summary}\n\n---\n*Powered by RevBot Reviewer*`;
                            await githubAppService.postComment(
                                installation.id,
                                repo.owner.login,
                                repo.name,
                                pr.number,
                                commentBody
                            );
                        } catch (reviewError) {
                            console.error('Failed to create inline review:', reviewError.message);
                            // Fall back to regular comment
                            const commentBody = `## RevBot Review Results\n\n${summary}\n\n---\n*Powered by RevBot Reviewer*`;
                            await githubAppService.postComment(
                                installation.id,
                                repo.owner.login,
                                repo.name,
                                pr.number,
                                commentBody
                            );
                        }
                    } else {
                        // No line numbers found, post summary comment
                        const commentBody = `## RevBot Review Results\n\n${summary}\n\n---\n*Powered by RevBot Reviewer*`;
                        await githubAppService.postComment(
                            installation.id,
                            repo.owner.login,
                            repo.name,
                            pr.number,
                            commentBody
                        );
                    }
                    
                    console.log(`PR #${pr.number} analysis complete\n`);

                } catch (error) {
                    console.error(`Analysis failed for PR #${pr.number}:`, error.message);
                    
                    // Update check run with failure
                    if (checkRunId) {
                        try {
                            await githubAppService.updateCheckRun(
                                installation.id,
                                repo.owner.login,
                                repo.name,
                                checkRunId,
                                {
                                    status: 'completed',
                                    conclusion: 'failure',
                                    completed_at: new Date().toISOString(),
                                    output: {
                                        title: 'Code Review Failed',
                                        summary: `Analysis encountered an error: ${error.message}`
                                    }
                                }
                            );
                        } catch (updateError) {
                            console.error('Failed to update check run:', updateError.message);
                        }
                    }
                    
                    global.analysisResults = global.analysisResults || {};
                    global.analysisResults[executionId] = {
                        executionId,
                        status: 'failed',
                        error: error.message,
                        prUrl: pr.html_url
                    };
                }
            })();

            return;
        }
    }

    if (event === 'installation' || event === 'installation_repositories') {
        console.log('Installation event:', req.body.action);
        global.installations = global.installations || new Map();
        
        if (req.body.installation) {
            global.installations.set(req.body.installation.id, {
                id: req.body.installation.id,
                account: req.body.installation.account.login,
                repositories: req.body.repositories || [],
                action: req.body.action,
                timestamp: new Date().toISOString()
            });
        }
    }

    res.json({ message: 'Event received', event });
});

router.post('/analyze-pr', async (req, res) => {
    const { prUrl, repository, prNumber } = req.body;

    if (!prUrl) {
        return res.status(400).json({ error: 'PR URL is required' });
    }

    try {
        const clineService = require('../services/clineService');
        const executionId = `exec-${Date.now()}`;
        
        res.json({
            message: 'Analysis started',
            executionId,
            status: 'running'
        });

        clineService.analyzePRDiff(prUrl)
            .then(result => {
                global.analysisResults = global.analysisResults || {};
                global.analysisResults[executionId] = {
                    executionId,
                    status: 'completed',
                    results: result,
                    prUrl,
                    repository,
                    prNumber
                };
                console.log(`Analysis completed: ${executionId}`);
            })
            .catch(error => {
                global.analysisResults = global.analysisResults || {};
                global.analysisResults[executionId] = {
                    executionId,
                    status: 'failed',
                    error: error.message,
                    prUrl
                };
                console.error(`Analysis failed: ${executionId}`, error);
            });
            
    } catch (error) {
        console.error('Analysis trigger error:', error.message);
        return res.status(500).json({ error: 'Failed to trigger analysis' });
    }
});

router.get('/results/:executionId', async (req, res) => {
    const { executionId } = req.params;

    try {
        global.analysisResults = global.analysisResults || {};
        const result = global.analysisResults[executionId];
        
        if (!result) {
            return res.json({
                executionId,
                status: 'running',
                results: {}
            });
        }

        return res.json(result);
    } catch (error) {
        console.error('Failed to fetch results:', error.message);
        return res.status(500).json({ error: 'Failed to fetch results' });
    }
});

module.exports = router;
