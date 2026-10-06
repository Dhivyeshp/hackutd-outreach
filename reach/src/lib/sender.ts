export interface SenderUser {
  name: string;
  email: string;
  senderTitle: string;
}

/** Display name + title used for {{sender_name}} / {{sender_title}} and the From header. */
export const senderOf = (u: SenderUser) => ({ name: u.name || u.email, title: u.senderTitle });
