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
import { CacheKeys } from '../../shared/cache/cache-keys';
import { CacheService } from '../../shared/cache/cache.service';
import {
  ADMIN_ROLE_IDS,
  DEFAULT_ROLE_PERMISSIONS,
  GUEST_ROLE_EXTRA_PERMISSION_KEYS,
  GUEST_STOREFRONT_PERMISSION_KEYS,
  LEGACY_REMOVED_ROLE_IDS,
  PERMISSION_KEYS,
  ROLE_DEFINITIONS,
  ROLE_PERMISSIONS_KEY,
  USER_ROLE_TO_PERMISSION_ROLE,
  type AdminRoleId,
  type GuestStorefrontPermissionKey,
  type PermissionKey,
} from './role-permissions.constants';
import type { GuestStorefrontPermissions } from '../../common/utils/guest-storefront-policy';
import { resolveEffectiveGuestStorefrontPermissions } from '../../common/utils/guest-storefront-policy';

export type { GuestStorefrontPermissions };

@Injectable()
export class RolePermissionsService {
  constructor(
    @InjectModel(RolePermissions.name)
    private readonly model: Model<RolePermissionsDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly cacheService: CacheService,
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

    const sanitized = this.sanitizePermissions(roleId as AdminRoleId, permissions);
    const doc = await this.getOrCreate();
    doc.roles[roleId] = sanitized;
    doc.markModified('roles');
    await doc.save();
    await this.invalidateGuestPolicyCaches(roleId);

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
    await this.invalidateGuestPolicyCaches(roleId);

    return this.buildRole(roleId as AdminRoleId, doc);
  }

  async resetAll() {
    const doc = await this.getOrCreate();
    doc.roles = {};
    doc.markModified('roles');
    await doc.save();
    await this.invalidateGuestPolicyCaches('guest');
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

  /** Storefront /media playback (Roles → Guest for visitors without JWT). */
  async siteAllowsGuestMediaPlay(): Promise<boolean> {
    const doc = await this.getOrCreate();
    const role = this.buildRole('guest', doc);
    return Boolean(role.permissions.play_media_catalog);
  }

  async userCanPlayMediaCatalog(userRoles: string[]): Promise<boolean> {
    if (await this.rolesHavePermission(userRoles, 'play_media_catalog')) {
      return true;
    }
    return this.rolesHavePermission(userRoles, 'manage_media_catalog');
  }

  async resolveMediaPlayAllowed(
    user?: { roles: string[] } | null,
  ): Promise<boolean> {
    if (user?.roles?.length) {
      return this.userCanPlayMediaCatalog(user.roles);
    }
    return this.siteAllowsGuestMediaPlay();
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

  /** Storefront limits for ephemeral guest sessions (Roles → Guest profile). */
  async getGuestStorefrontPermissions(): Promise<GuestStorefrontPermissions> {
    const doc = await this.getOrCreate();
    const role = this.buildRole('guest', doc);
    const guestLiveChat = Boolean(
      role.permissions.live_chat_without_login ??
        role.permissions.guest_live_chat,
    );
    const raw: GuestStorefrontPermissions = {
      guest_browse_storefront: Boolean(role.permissions.guest_browse_storefront),
      guest_use_cart: Boolean(role.permissions.guest_checkout),
      guest_checkout: Boolean(role.permissions.guest_checkout),
      guest_live_chat: guestLiveChat,
      guest_view_media: Boolean(role.permissions.play_media_catalog),
    };
    return resolveEffectiveGuestStorefrontPermissions(raw);
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
      return doc;
    }
    await this.purgeLegacyRoleProfiles(doc);
    return doc;
  }

  /** Drop retired media staff profiles; keep `movie_server` as the single Movie Server role. */
  private async purgeLegacyRoleProfiles(
    doc: RolePermissionsDocument,
  ): Promise<void> {
    let dirty = false;
    for (const legacyId of LEGACY_REMOVED_ROLE_IDS) {
      if (!doc.roles?.[legacyId]) continue;
      delete doc.roles[legacyId];
      dirty = true;
    }
    if (!dirty) return;
    doc.markModified('roles');
    await doc.save();
  }

  private buildRoles(doc: RolePermissionsDocument) {
    return ADMIN_ROLE_IDS.map((id) => this.buildRole(id, doc));
  }

  private buildRole(roleId: AdminRoleId, doc: RolePermissionsDocument) {
    const def = ROLE_DEFINITIONS.find((r) => r.id === roleId)!;
    const stored = doc.roles?.[roleId];
    const defaults = DEFAULT_ROLE_PERMISSIONS[roleId];
    let permissions = def.locked
      ? { ...defaults }
      : { ...defaults, ...(stored ?? {}) };
    if (roleId === 'guest') {
      const withoutLogin = Boolean(
        permissions.live_chat_without_login ?? permissions.guest_live_chat,
      );
      const storedPlay = stored?.play_media_catalog;
      const legacyBrowse = Boolean(stored?.guest_view_media);
      const playMedia =
        typeof storedPlay === 'boolean'
          ? storedPlay
          : legacyBrowse || Boolean(permissions.play_media_catalog);
      permissions = {
        ...permissions,
        guest_use_cart: permissions.guest_checkout,
        live_chat_without_login: withoutLogin,
        guest_live_chat: withoutLogin,
        play_media_catalog: playMedia,
        guest_view_media: false,
      };
    }
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

  private async invalidateGuestPolicyCaches(roleId: string): Promise<void> {
    if (roleId === 'guest') {
      await this.cacheService.del(CacheKeys.settings.panel);
    }
  }

  private sanitizePermissions(
    roleId: AdminRoleId,
    input: Record<string, boolean>,
  ): Record<PermissionKey, boolean> {
    const out = { ...DEFAULT_ROLE_PERMISSIONS[roleId] };
    for (const key of PERMISSION_KEYS) {
      if (typeof input[key] === 'boolean') {
        out[key] = input[key];
      }
    }
    if (roleId === 'guest') {
      const guestAllowed = new Set<string>([
        ...GUEST_STOREFRONT_PERMISSION_KEYS,
        ...GUEST_ROLE_EXTRA_PERMISSION_KEYS,
        'guest_live_chat',
      ]);
      for (const key of PERMISSION_KEYS) {
        if (!guestAllowed.has(key)) {
          out[key] = false;
        }
      }
      out.guest_use_cart = out.guest_checkout;
      out.guest_view_media = false;
      if (typeof input.live_chat_without_login === 'boolean') {
        out.live_chat_without_login = input.live_chat_without_login;
      } else if (typeof input.guest_live_chat === 'boolean') {
        out.live_chat_without_login = input.guest_live_chat;
      }
      out.guest_live_chat = out.live_chat_without_login;
    } else {
      for (const key of GUEST_STOREFRONT_PERMISSION_KEYS) {
        out[key as PermissionKey] = false;
      }
    }
    out.guest_view_media = false;
    return out;
  }
}
