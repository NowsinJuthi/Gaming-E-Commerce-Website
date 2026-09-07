import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  RolePermissions,
  RolePermissionsDocument,
} from '../../database/schemas/role-permissions.schema';
import { User, UserDocument } from '../../database/schemas/user.schema';
import {
  ADMIN_ROLE_IDS,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_KEYS,
  ROLE_DEFINITIONS,
  ROLE_PERMISSIONS_KEY,
  USER_ROLE_TO_PERMISSION_ROLE,
  type AdminRoleId,
  type PermissionKey,
} from './role-permissions.constants';

@Injectable()
export class RolePermissionsService {
  constructor(
    @InjectModel(RolePermissions.name)
    private readonly model: Model<RolePermissionsDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async getOverview() {
    const doc = await this.getOrCreate();
    const roles = this.buildRoles(doc);
    const customized = roles.filter((r) => r.customized).length;
    const adminAccess = roles.filter(
      (r) => r.permissions.admin_panel_access,
    ).length;

    return {
      roleCount: ROLE_DEFINITIONS.length,
      customizedCount: customized,
      adminAccessCount: adminAccess,
      roles,
      groups: ROLE_DEFINITIONS.map((d) => ({
        id: d.id,
        label: d.label,
        locked: d.locked,
      })),
    };
  }

  async updateRole(roleId: string, permissions: Record<string, boolean>) {
    if (!ADMIN_ROLE_IDS.includes(roleId as AdminRoleId)) {
      throw new NotFoundException('Role not found');
    }

    const def = ROLE_DEFINITIONS.find((r) => r.id === roleId);
    if (def?.locked) {
      throw new BadRequestException('Administrator role cannot be modified');
    }

    const sanitized = this.sanitizePermissions(permissions);
    const doc = await this.getOrCreate();
    doc.roles[roleId] = sanitized;
    doc.markModified('roles');
    await doc.save();

    return this.buildRole(roleId as AdminRoleId, doc);
  }

  async resetRole(roleId: string) {
    if (!ADMIN_ROLE_IDS.includes(roleId as AdminRoleId)) {
      throw new NotFoundException('Role not found');
    }

    const def = ROLE_DEFINITIONS.find((r) => r.id === roleId);
    if (def?.locked) {
      throw new BadRequestException('Administrator role cannot be reset');
    }

    const doc = await this.getOrCreate();
    delete doc.roles[roleId];
    doc.markModified('roles');
    await doc.save();

    return this.buildRole(roleId as AdminRoleId, doc);
  }

  async resetAll() {
    const doc = await this.getOrCreate();
    doc.roles = {};
    doc.markModified('roles');
    await doc.save();
    return this.getOverview();
  }

  async userIdHasPermission(
    userId: string | Types.ObjectId,
    permission: PermissionKey,
  ): Promise<boolean> {
    const user = await this.userModel
      .findById(userId)
      .select('roles')
      .lean()
      .exec();
    if (!user?.roles?.length) {
      return false;
    }
    return this.rolesHavePermission(user.roles, permission);
  }

  async rolesHavePermission(
    userRoles: string[],
    permission: PermissionKey,
  ): Promise<boolean> {
    const doc = await this.getOrCreate();
    const permissionRoleIds = this.resolvePermissionRoleIds(userRoles);
    return permissionRoleIds.some((roleId) => {
      const role = this.buildRole(roleId, doc);
      return Boolean(role.permissions[permission]);
    });
  }

  /** Merged effective permissions for the user's JWT roles (OR across profiles). */
  async getEffectivePermissionsForUser(
    userRoles: string[],
  ): Promise<Record<PermissionKey, boolean>> {
    const doc = await this.getOrCreate();
    return this.mergeRolePermissions(userRoles, doc);
  }

  private mergeRolePermissions(
    userRoles: string[],
    doc: RolePermissionsDocument,
  ): Record<PermissionKey, boolean> {
    const permissionRoleIds = this.resolvePermissionRoleIds(userRoles);
    const merged = { ...DEFAULT_ROLE_PERMISSIONS.customer };
    for (const roleId of permissionRoleIds) {
      const role = this.buildRole(roleId, doc);
      for (const key of PERMISSION_KEYS) {
        if (role.permissions[key]) {
          merged[key] = true;
        }
      }
    }
    return merged;
  }

  private resolvePermissionRoleIds(userRoles: string[]): AdminRoleId[] {
    const resolved = new Set<AdminRoleId>();
    for (const userRole of userRoles) {
      if (ADMIN_ROLE_IDS.includes(userRole as AdminRoleId)) {
        resolved.add(userRole as AdminRoleId);
        continue;
      }
      const mapped = USER_ROLE_TO_PERMISSION_ROLE[userRole];
      if (mapped) {
        resolved.add(mapped);
      }
    }
    return [...resolved];
  }

  private async getOrCreate(): Promise<RolePermissionsDocument> {
    let doc = await this.model.findOne({ key: ROLE_PERMISSIONS_KEY }).exec();
    if (!doc) {
      doc = await this.model.create({ key: ROLE_PERMISSIONS_KEY, roles: {} });
    }
    return doc;
  }

  private buildRoles(doc: RolePermissionsDocument) {
    return ADMIN_ROLE_IDS.map((id) => this.buildRole(id, doc));
  }

  private buildRole(roleId: AdminRoleId, doc: RolePermissionsDocument) {
    const def = ROLE_DEFINITIONS.find((r) => r.id === roleId)!;
    const stored = doc.roles?.[roleId];
    const defaults = DEFAULT_ROLE_PERMISSIONS[roleId];
    const permissions = def.locked
      ? { ...defaults }
      : { ...defaults, ...(stored ?? {}) };
    const customized = stored
      ? PERMISSION_KEYS.some((k) => stored[k] !== defaults[k])
      : false;

    return {
      id: roleId,
      label: def.label,
      description: def.description,
      locked: def.locked,
      summary: def.summary,
      customized,
      permissions,
    };
  }

  private sanitizePermissions(
    input: Record<string, boolean>,
  ): Record<PermissionKey, boolean> {
    const out = { ...DEFAULT_ROLE_PERMISSIONS.customer };
    for (const key of PERMISSION_KEYS) {
      if (typeof input[key] === 'boolean') {
        out[key] = input[key];
      }
    }
    return out;
  }
}
