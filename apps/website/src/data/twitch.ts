export const scopeLabels = {
  // User
  openid: "OpenID",
  "user:read:email": "User Email (Read)",
  "user:read:follows": "User Follows (Read)",
  "user:read:subscriptions": "User Subscriptions (Read)",
  // Chat
  "chat:edit": "Chat (Edit)",
  "chat:read": "Chat (Read)",
  // Moderator
  "moderator:read:followers": "Moderator Followers (Read)",
  // Channel
  "channel:read:charity": "Channel Charity (Read)",
  "channel:read:subscriptions": "Channel Subscriptions (Read)",
  "channel:read:vips": "Channel VIPs (Read)",
  "channel:manage:schedule": "Channel Schedule (Manage)",
} as const satisfies Record<string, string>;

export type Scope = keyof typeof scopeLabels;

export const isScope = (scope: string): scope is Scope => scope in scopeLabels;

export const defaultScopes = [
  "openid",
  "user:read:email",
  "user:read:follows",
  "user:read:subscriptions",
] as const satisfies Scope[];

export const botScopes = [
  "chat:edit",
  "chat:read",
  "moderator:read:followers",
  "channel:read:charity",
  "channel:read:subscriptions",
  "channel:read:vips",
  "channel:manage:schedule",
] as const satisfies Scope[];
