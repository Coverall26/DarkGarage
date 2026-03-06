import { Unsend } from "unsend";

import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

const unsend = process.env.UNSEND_API_KEY
  ? new Unsend(process.env.UNSEND_API_KEY, process.env.UNSEND_BASE_URL)
  : null;

const contactBookId = process.env.UNSEND_CONTACT_BOOK_ID as string;

const subscribe = async (email: string) => {
  if (!unsend) {
    logger.error("UNSEND_API_KEY is not set, skipping", { module: "unsend" });
    return;
  }

  if (!contactBookId) {
    logger.error("UNSEND_CONTACT_BOOK_ID is not set, skipping", { module: "unsend" });
    return;
  }

  const contactId = await unsend.contacts.create(contactBookId, {
    email,
  });

  if (!contactId.data?.contactId) {
    return;
  }

  await prisma.user.update({
    where: {
      email,
    },
    data: {
      contactId: contactId.data.contactId,
    },
  });
};

const unsubscribe = async (email: string): Promise<void> => {
  if (!unsend) {
    logger.error("UNSEND_API_KEY is not set, skipping", { module: "unsend" });
    return;
  }

  if (!contactBookId) {
    logger.error("UNSEND_CONTACT_BOOK_ID is not set, skipping", { module: "unsend" });
    return;
  }

  if (!email || email === "") {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { contactId: true },
  });

  if (!user?.contactId) {
    return;
  }

  await unsend.contacts.update(contactBookId, user.contactId, {
    subscribed: false,
  });
};

export default unsend;
export { subscribe, unsubscribe };
