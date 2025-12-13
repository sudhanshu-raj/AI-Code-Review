const express = require('express');
const router = express.Router();
const githubAppService = require('../services/githubAppService');

const sessions = new Map();
const installations = new Map();

router.get('/install', (req, res) => {
    const appName = encodeURIComponent(process.env.GITHUB_APP_NAME);
    const callbackUrl = encodeURIComponent(`${process.env.FRONTEND_URL}/auth/callback`);
    const installUrl = `https://github.com/apps/${appName}/installations/new?state=${callbackUrl}`;
    res.redirect(installUrl);
});

router.get('/setup/callback', async (req, res) => {
    const { installation_id, setup_action } = req.query;
    
    console.log('=== SETUP CALLBACK HIT ===');
    console.log('Full query params:', req.query);
    console.log('Installation ID:', installation_id);
    console.log('Setup action:', setup_action);
    console.log('==========================');
    
    if (installation_id) {
        try {
            // Clear cache to force fresh data fetch
            installations.delete(installation_id);
            
            const repositories = await githubAppService.getInstallationRepositories(installation_id);
            
            // Store by installation_id for persistence
            installations.set(installation_id, {
                installationId: installation_id,
                repositories: repositories,
                updatedAt: new Date()
            });
            
            // Redirect with refresh flag to force frontend to reload
            res.redirect(`${process.env.FRONTEND_URL}/dashboard?installation=${installation_id}&refresh=true`);
        } catch (error) {
            console.error('Setup callback error:', error);
            res.redirect(`${process.env.FRONTEND_URL}?error=setup_failed`);
        }
    } else {
        res.redirect(`${process.env.FRONTEND_URL}?error=no_installation`);
    }
});

router.get('/session/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);

    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
        installationId: session.installationId,
        repositories: session.repositories || []
    });
});

// Getting installation data by installation_id
router.get('/installation/:installationId', async (req, res) => {
    const { installationId } = req.params;
    const { refresh } = req.query;
    
    console.log('=== INSTALLATION DATA REQUEST ===');
    console.log('Installation ID:', installationId);
    console.log('Force refresh:', refresh === 'true');
    
    try {
        // Check cache first
        let installation = installations.get(installationId);
        
        console.log('Cached installation:', installation ? 'Found' : 'Not found');
        
        // If refresh=true, or not in cache, or older than 5 minutes, fetch fresh data
        if (refresh === 'true' || !installation || (Date.now() - installation.updatedAt) > 5 * 60 * 1000) {
            console.log('Fetching fresh data from GitHub...');
            const repositories = await githubAppService.getInstallationRepositories(installationId);
            installation = {
                installationId,
                repositories,
                updatedAt: new Date()
            };
            installations.set(installationId, installation);
            console.log('Fetched', repositories.length, 'repositories');
        }
        
        res.json({
            installationId: installation.installationId,
            repositories: installation.repositories || []
        });
    } catch (error) {
        console.error('Failed to fetch installation:', error.message);
        res.status(500).json({ error: 'Failed to fetch installation data' });
    }
});

router.get('/installations/:installationId/repositories', async (req, res) => {
    const { installationId } = req.params;

    try {
        const repositories = await githubAppService.getInstallationRepositories(installationId);
        res.json({ repositories });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch repositories' });
    }
});

router.post('/installations/:installationId/analyze', async (req, res) => {
    const { installationId } = req.params;
    const { owner, repo, prNumber } = req.body;

    try {
        const executionId = `exec-${Date.now()}`;
        
        res.json({
            message: 'Analysis started',
            executionId,
            status: 'running'
        });

        const clineService = require('../services/clineService');
        const prUrl = `https://github.com/${owner}/${repo}/pull/${prNumber}`;
        
        const result = await clineService.analyzePRDiff(prUrl);
        
        global.analysisResults = global.analysisResults || {};
        global.analysisResults[executionId] = {
            executionId,
            status: 'completed',
            results: result,
            prUrl,
            repository: `${owner}/${repo}`,
            prNumber
        };

        const commentBody = `## RevBot Review Results\n\n**Quality Score:** ${result.qualityScore}/100\n**Risk Level:** ${result.riskLevel}\n\n### Issues Found:\n${result.issues.map(issue => `- ${issue}`).join('\n')}`;

        await githubAppService.postComment(installationId, owner, repo, prNumber, commentBody);

    } catch (error) {
        console.error('Analysis error:', error);
        global.analysisResults[executionId] = {
            executionId,
            status: 'failed',
            error: error.message
        };
    }
});

// Get repositories for an installation
router.get('/installations/:installationId/repositories', async (req, res) => {
  try {
    const { installationId } = req.params;
    const repositories = await githubAppService.getInstallationRepositories(installationId);
    res.json({ repositories });
  } catch (error) {
    console.error('Error fetching repositories:', error.message);
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

// Get pull requests for a repository
router.get('/installations/:installationId/repositories/:owner/:repo/pulls', async (req, res) => {
  try {
    const { installationId, owner, repo } = req.params;
    const pullRequests = await githubAppService.getRepositoryPullRequests(installationId, owner, repo);
    res.json({ pullRequests });
  } catch (error) {
    console.error('Error fetching pull requests:', error.message);
    res.status(500).json({ error: 'Failed to fetch pull requests' });
  }
});

module.exports = router;
