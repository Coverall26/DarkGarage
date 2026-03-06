"use client";

import { ComponentProps } from "react";

import { ConversationListItem as ConversationListItemEE } from "@/ee/features/conversations/components/dashboard/conversation-list-item";
import { ConversationMessage as ConversationMessageEE } from "@/ee/features/conversations/components/shared/conversation-message";

export function ConversationListItem(props: ComponentProps<typeof ConversationListItemEE>) {
  return <ConversationListItemEE {...props} />;
}

export function ConversationMessage(props: ComponentProps<typeof ConversationMessageEE>) {
  return <ConversationMessageEE {...props} />;
}
