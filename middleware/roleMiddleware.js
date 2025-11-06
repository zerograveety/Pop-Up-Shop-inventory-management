/**
 * Role-based access control middleware
 * Checks if the authenticated user has one of the required roles
 */

const roleMiddleware = (allowedRoles) => {
  return (req, res, next) => {
    try {
      // Check if user is authenticated (should be set by authMiddleware)
      if (!req.user) {
        return res.status(401).json({ 
          error: 'Authentication required. Please login first.' 
        });
      }

      // Convert single role to array for consistency
      const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
      
      // Check if user's role is in the allowed roles
      const userRole = req.user.role;
      const hasPermission = roles.some(role => 
        role.toLowerCase() === userRole.toLowerCase()
      );

      if (!hasPermission) {
        return res.status(403).json({ 
          error: `Access denied. Required role(s): ${roles.join(', ')}. Your role: ${userRole}` 
        });
      }

      // User has required role, proceed
      next();

    } catch (error) {
      console.error('Role middleware error:', error);
      return res.status(500).json({ 
        error: 'Internal server error during role verification.' 
      });
    }
  };
};

// Specific role middlewares for common use cases
const adminOnly = roleMiddleware(['Admin']);
const managerOnly = roleMiddleware(['Manager']);
const managerOrAdmin = roleMiddleware(['Manager', 'Admin']);
// Backward compatibility: Cashier role removed. Treat "cashier or above" as Manager or Admin.
const cashierOrAbove = managerOrAdmin;

// Role hierarchy helper
const roleHierarchy = {
  'Admin': 2,
  'Manager': 1
};

/**
 * Checks if user has minimum required role level
 * @param {string} minimumRole - Minimum role required
 */
const requireMinimumRole = (minimumRole) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ 
          error: 'Authentication required.' 
        });
      }

      const userRoleLevel = roleHierarchy[req.user.role] || 0;
      const requiredRoleLevel = roleHierarchy[minimumRole] || 0;

      if (userRoleLevel < requiredRoleLevel) {
        return res.status(403).json({ 
          error: `Access denied. Minimum role required: ${minimumRole}. Your role: ${req.user.role}` 
        });
      }

      next();

    } catch (error) {
      console.error('Minimum role middleware error:', error);
      return res.status(500).json({ 
        error: 'Internal server error during role verification.' 
      });
    }
  };
};

module.exports = {
  roleMiddleware,
  adminOnly,
  managerOnly,
  managerOrAdmin,
  cashierOrAbove,
  requireMinimumRole
};