const axios = require('axios');
const jwt = require('jsonwebtoken');
const fs = require('fs');

class GitHubAppService {
    constructor() {
        this.appId = process.env.GITHUB_APP_ID;
        this.privateKey = process.env.GITHUB_PRIVATE_KEY;
        this.clientId = process.env.GITHUB_CLIENT_ID;
        this.clientSecret = process.env.GITHUB_CLIENT_SECRET;
        this.installationTokens = new Map();
    }

    generateJWT() {
        const now = Math.floor(Date.now() / 1000);
        const payload = {
            iat: now,
            exp: now + 600,
            iss: this.appId
        };
        
        return jwt.sign(payload, this.privateKey, { algorithm: 'RS256' });
    }

    async getInstallationToken(installationId) {
        const cached = this.installationTokens.get(installationId);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.token;
        }

        const jwtToken = this.generateJWT();
        
        try {
            const response = await axios.post(
                `https://api.github.com/app/installations/${installationId}/access_tokens`,
                {},
                {
                    headers: {
                        Authorization: `Bearer ${jwtToken}`,
                        Accept: 'application/vnd.github.v3+json'
                    }
                }
            );

            const token = response.data.token;
            const expiresAt = new Date(response.data.expires_at).getTime();
            
            this.installationTokens.set(installationId, { token, expiresAt });
            
            return token;
        } catch (error) {
            console.error('Failed to get installation token:', error.message);
            throw error;
        }
    }

    // Not curretly using, used for oauth
    async exchangeCodeForToken(code) {
        try {
            const response = await axios.post(
                'https://github.com/login/oauth/access_token',
                {
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    code: code
                },
                {
                    headers: {
                        Accept: 'application/json'
                    }
                }
            );

            return response.data.access_token;
        } catch (error) {
            console.error('OAuth token exchange failed:', error.message);
            throw error;
        }
    }

    // Not curretly using, used for oauth
    async getUserInstallations(userToken) {
        try {
            const response = await axios.get(
                'https://api.github.com/user/installations',
                {
                    headers: {
                        Authorization: `Bearer ${userToken}`,
                        Accept: 'application/vnd.github.v3+json'
                    }
                }
            );

            return response.data.installations;
        } catch (error) {
            console.error('Failed to fetch installations:', error.message);
            throw error;
        }
    }

    async getInstallationRepositories(installationId) {
        try {
            const token = await this.getInstallationToken(installationId);
            
            const response = await axios.get(
                `https://api.github.com/installation/repositories`,
                {
                    headers: {
                        Authorization: `token ${token}`,
                        Accept: 'application/vnd.github.v3+json'
                    }
                }
            );

            return response.data.repositories;
        } catch (error) {
            console.error('Failed to fetch repositories:', error.message);
            throw error;
        }
    }

    async createCheckRun(installationId, owner, repo, data) {
        try {
            const token = await this.getInstallationToken(installationId);
            
            const response = await axios.post(
                `https://api.github.com/repos/${owner}/${repo}/check-runs`,
                data,
                {
                    headers: {
                        Authorization: `token ${token}`,
                        Accept: 'application/vnd.github.v3+json'
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error('Failed to create check run:', error.message);
            throw error;
        }
    }

    async updateCheckRun(installationId, owner, repo, checkRunId, data) {
        try {
            const token = await this.getInstallationToken(installationId);
            
            const response = await axios.patch(
                `https://api.github.com/repos/${owner}/${repo}/check-runs/${checkRunId}`,
                data,
                {
                    headers: {
                        Authorization: `token ${token}`,
                        Accept: 'application/vnd.github.v3+json'
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error('Failed to update check run:', error.message);
            throw error;
        }
    }

    async postComment(installationId, owner, repo, prNumber, body) {
        try {
            const token = await this.getInstallationToken(installationId);
            
            const response = await axios.post(
                `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`,
                { body },
                {
                    headers: {
                        Authorization: `token ${token}`,
                        Accept: 'application/vnd.github.v3+json'
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error('Failed to post comment:', error.message);
            throw error;
        }
    }

    async createReview(installationId, owner, repo, prNumber, commitSha, comments, event = 'COMMENT') {
        try {
            const token = await this.getInstallationToken(installationId);
            
            const response = await axios.post(
                `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews`,
                {
                    commit_id: commitSha,
                    event: event,
                    comments: comments
                },
                {
                    headers: {
                        Authorization: `token ${token}`,
                        Accept: 'application/vnd.github.v3+json'
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error('Failed to create review:', error.response?.data || error.message);
            throw error;
        }
    }

    async getRepositoryPullRequests(installationId, owner, repo) {
        try {
            const token = await this.getInstallationToken(installationId);
            
            const response = await axios.get(
                `https://api.github.com/repos/${owner}/${repo}/pulls`,
                {
                    headers: {
                        Authorization: `token ${token}`,
                        Accept: 'application/vnd.github.v3+json'
                    },
                    params: {
                        state: 'all', // Get both open and closed PRs
                        sort: 'updated',
                        direction: 'desc',
                        per_page: 20
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error('Failed to fetch pull requests:', error.message);
            throw error;
        }
    }
}

module.exports = new GitHubAppService();
