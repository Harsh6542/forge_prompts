import { Injectable } from '@nestjs/common';

@Injectable()
export class RbacService {

  /**
   * Enum of all possible user roles (as strings for DB storage)
   */
  static USER_ROLE = {
    SUPERADMIN: 'superadmin',
    PWD_ADMIN: 'pwd_admin',
    JALBOARD_ADMIN: 'jalboard_admin',
    MUNICIPAL_ADMIN: 'municipal_admin',
    DISCO_ADMIN: 'disco_admin',
    SPCB_ADMIN: 'spcb_admin',
    SMA_ADMIN: 'sma_admin',
    PUBLIC_USER: 'public_user',
  };

  /**
   * Enum of all possible user departments
   */
  static USER_DEPARTMENT = {
    PWD: 'PWD',
    JALBOARD: 'JalBoard',
    MUNICIPAL: 'Municipal',
    ALL: 'all',
  };

  /**
   * Maps a role to its associated department
   * @param role The user role
   * @returns The department the role has access to (or 'all' for superadmin)
   */
  getDeptForRole(role: string): string {
    const map: Record<string, string> = {
      [RbacService.USER_ROLE.SUPERADMIN]: RbacService.USER_DEPARTMENT.ALL,
      [RbacService.USER_ROLE.PWD_ADMIN]: RbacService.USER_DEPARTMENT.PWD,
      [RbacService.USER_ROLE.JALBOARD_ADMIN]: RbacService.USER_DEPARTMENT.JALBOARD,
      [RbacService.USER_ROLE.MUNICIPAL_ADMIN]: RbacService.USER_DEPARTMENT.MUNICIPAL,
      [RbacService.USER_ROLE.DISCO_ADMIN]: RbacService.USER_DEPARTMENT.PWD,
      [RbacService.USER_ROLE.SPCB_ADMIN]: RbacService.USER_DEPARTMENT.PWD,
      [RbacService.USER_ROLE.SMA_ADMIN]: RbacService.USER_DEPARTMENT.PWD,
      [RbacService.USER_ROLE.PUBLIC_USER]: RbacService.USER_DEPARTMENT.ALL,
    };
    return map[role] || RbacService.USER_DEPARTMENT.ALL;
  }

  /**
   * Gets the grievance categories associated with a department
   * @param department The department code
   * @returns Array of grievance categories
   */
  getCategoriesForDepartment(department: string): string[] {
    const map: Record<string, string[]> = {
      [RbacService.USER_DEPARTMENT.PWD]: ['road', 'bridge'],
      [RbacService.USER_DEPARTMENT.JALBOARD]: ['water', 'drainage'],
      [RbacService.USER_DEPARTMENT.MUNICIPAL]: ['garbage', 'sanitation', 'other'],
      [RbacService.USER_DEPARTMENT.ALL]: [
        'road', 'bridge', 'water', 'drainage', 'garbage', 'sanitation',
        'electricity', 'pollution', 'flood', 'disaster', 'other',
      ],
    };
    return map[department] || [];
  }

  /**
   * Checks if a role has superadmin privileges
   * @param role The role string to check
   */
  isSuperadmin(role: string): boolean {
    return role === RbacService.USER_ROLE.SUPERADMIN;
  }

  /**
   * Checks if a role can access all departments
   * @param role The role to check
   */
  canAccessAllDepartments(role: string): boolean {
    return this.isSuperadmin(role);
  }

  /**
   * Gets the SLA (Service Level Agreement) in hours for a severity score
   * @param severityScore The grievance severity score (1-10)
   */
  getSlaForSeverity(severityScore: number): string {
    if (severityScore >= 8) return '24 hours'; // CRITICAL
    if (severityScore >= 6) return '72 hours'; // HIGH
    if (severityScore >= 4) return '7 days';   // MEDIUM
    return '30 days';                          // LOW
  }

  /**
   * Gets the priority color for a severity score
   * @param severityScore The grievance severity score (1-10)
   */
  getPriorityColor(severityScore: number): string {
    if (severityScore >= 8) return 'Red';      // CRITICAL
    if (severityScore >= 6) return 'Orange';   // HIGH
    if (severityScore >= 4) return 'Yellow';   // MEDIUM
    return 'Green';                            // LOW
  }

  /**
   * Gets the department name for a department code
   * @param departmentCode The department code (PWD, JalBoard, Municipal, etc.)
   */
  getDepartmentName(departmentCode: string): string {
    const map: Record<string, string> = {
      [RbacService.USER_DEPARTMENT.PWD]: 'Public Works Department (PWD)',
      [RbacService.USER_DEPARTMENT.JALBOARD]: 'Jal Board / Water Authority',
      [RbacService.USER_DEPARTMENT.MUNICIPAL]: 'Municipal Corporation',
      [RbacService.USER_DEPARTMENT.ALL]: 'All Departments',
    };
    return map[departmentCode] || departmentCode;
  }

  /**
   * Checks if a user can manage other users
   * @param userRole The user's role
   */
  canManageUsers(userRole: string): boolean {
    return this.isSuperadmin(userRole);
  }

  /**
   * Checks if a user can view grievances for a specific department
   * @param userRole The user's role
   * @param userDepartment The user's department from DB
   * @param targetDept The department to check access for
   */
  canViewDeptGrievances(userRole: string, userDepartment: string | null, targetDept: string): boolean {
    if (this.isSuperadmin(userRole)) {
      return true;
    }
    if (!this.isSuperadmin(userRole) && userRole !== RbacService.USER_ROLE.PUBLIC_USER) {
      const userDept = this.getDeptForRole(userRole);
      return userDept === targetDept;
    }
    return false;
  }

  /**
   * Checks if a user can edit a grievance status
   * @param userRole The user's role
   */
  canEditGrievanceStatus(userRole: string): boolean {
    return this.isSuperadmin(userRole);
  }

  /**
   * Gets the categories a role can manage
   * @param userRole The user's role
   */
  getManageableCategories(userRole: string): string[] {
    if (this.isSuperadmin(userRole)) {
      return ['road', 'bridge', 'water', 'drainage', 'garbage', 'sanitation',
        'electricity', 'pollution', 'flood', 'disaster', 'other'];
    }
    if (userRole === RbacService.USER_ROLE.PUBLIC_USER) {
      return [];
    }
    return this.getCategoriesForRole(userRole);
  }

  /**
   * Gets the categories for a role
   * @param userRole The user's role
   */
  getCategoriesForRole(userRole: string): string[] {
    return this.getCategoriesForDepartment(this.getDeptForRole(userRole));
  }
}