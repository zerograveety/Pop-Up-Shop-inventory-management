/**
 * Authentication middleware (JWT removed)
 * This middleware now injects a user on every request. It supports:
 * - A JSON `X-User` request header to provide a specific user object (for testing)
 * - An `X-Dev-Role` header to quickly change the role (Admin|Manager)
 * - Defaults to a Manager dev user when no headers are provided
 *
 * NOTE: Removing JWT means routes are protected only by the presence of req.user
 * and role middleware. Do not expose this server to untrusted networks.
 */
const authMiddleware = (req, res, next) => {
  try {
    // If a full user JSON is provided via header, use it
    const xUserHeader = req.headers['x-user'];
    if (xUserHeader) {
      try {
        const parsed = JSON.parse(xUserHeader);
        req.user = {
          id: parsed.id || parsed.user_id || 9999,
          name: parsed.name || 'Dev User',
          email: parsed.email || 'dev@example.com',
          role: parsed.role || 'Manager',
          roleId: parsed.roleId || (parsed.role === 'Admin' ? 1 : parsed.role === 'Manager' ? 2 : 3)
        };
        return next();
      } catch (e) {
        // fall through to other fallback methods
      }
    }

  // Quick role override (default to Admin for local dev so admin-only pages are reachable)
  const forcedRole = (req.headers['x-dev-role'] || 'Admin');
  const roleMap = { 'Admin': 1, 'Manager': 2 };
    req.user = {
      id: 9999,
      name: 'Dev User',
      email: 'dev@example.com',
      role: forcedRole,
      roleId: roleMap[forcedRole] || 2
    };

    return next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Internal server error during authentication.' });
  }
};

module.exports = authMiddleware;