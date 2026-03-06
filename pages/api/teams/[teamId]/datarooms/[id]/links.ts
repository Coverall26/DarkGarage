// MIGRATION STATUS: CRITICAL
// App Router equivalent: none — Phase 2 priority
// See docs/PAGES-ROUTER-MIGRATION.md
import { NextApiRequest, NextApiResponse } from "next";

import { getServerSession } from "next-auth/next";

import { errorhandler } from "@/lib/errorHandler";
import prisma from "@/lib/prisma";
import { CustomUser, LinkWithViews } from "@/lib/types";
import { decryptEncrpytedPassword, log } from "@/lib/utils";

import { authOptions } from "@/lib/auth/auth-options";

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === "GET") {
    // GET /api/teams/:teamId/datarooms/:id/links
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).end("Unauthorized");
    }

    const { teamId, id: dataroomId } = req.query as {
      teamId: string;
      id: string;
    };

    const userId = (session.user as CustomUser).id;

    try {
      // Check if the user is part of the team
      const team = await prisma.team.findUnique({
        where: {
          id: teamId,
          users: {
            some: {
              userId: userId,
            },
          },
        },
      });

      if (!team) {
        return res.status(401).end("Unauthorized");
      }

      const links = await prisma.link.findMany({
        where: {
          dataroomId,
          linkType: "DATAROOM_LINK",
          teamId: teamId,
          deletedAt: null, // exclude deleted links
        },
        orderBy: {
          createdAt: "desc",
        },
        include: {
          views: {
            where: {
              viewType: "DATAROOM_VIEW",
            },
            orderBy: {
              viewedAt: "desc",
            },
          },
          customFields: true,
          _count: {
            select: { views: { where: { viewType: "DATAROOM_VIEW" } } },
          },
        },
      });

      let extendedLinks: LinkWithViews[] = links as LinkWithViews[];
      // Batch-load related data to avoid N+1 queries
      if (extendedLinks && extendedLinks.length > 0) {
        const linkIds = extendedLinks.map((l) => l.id);

        // Batch: fetch all tags for all links in one query
        const tagItems = await prisma.tagItem.findMany({
          where: {
            linkId: { in: linkIds },
            itemType: "LINK_TAG",
          },
          include: {
            tag: {
              select: { id: true, name: true, color: true, description: true },
            },
          },
        });
        const tagsByLinkId = new Map<string, typeof tagItems[0]["tag"][]>();
        for (const item of tagItems) {
          if (!item.linkId) continue;
          const existing = tagsByLinkId.get(item.linkId) || [];
          existing.push(item.tag);
          tagsByLinkId.set(item.linkId, existing);
        }

        // Batch: fetch all upload folder names in one query
        const uploadFolderIds = extendedLinks
          .filter((l) => l.enableUpload && l.uploadFolderId !== null)
          .map((l) => l.uploadFolderId as string);
        const folderMap = new Map<string, string>();
        if (uploadFolderIds.length > 0) {
          const folders = await prisma.dataroomFolder.findMany({
            where: { id: { in: uploadFolderIds } },
            select: { id: true, name: true },
          });
          for (const f of folders) {
            folderMap.set(f.id, f.name);
          }
        }

        // Assemble results (no additional queries)
        extendedLinks = extendedLinks.map((link) => {
          if (link.password !== null) {
            link.password = decryptEncrpytedPassword(link.password);
          }
          if (link.enableUpload && link.uploadFolderId !== null) {
            link.uploadFolderName = folderMap.get(link.uploadFolderId) || undefined;
          }
          return {
            ...link,
            tags: tagsByLinkId.get(link.id) || [],
          };
        });
      }

      return res.status(200).json(extendedLinks);
    } catch (error) {
      log({
        message: `Failed to get links for dataroom: _${dataroomId}_. \n\n ${error} \n\n*Metadata*: \`{teamId: ${teamId}, userId: ${userId}}\``,
        type: "error",
      });
      errorhandler(error, res);
    }
  } else {
    // We only allow GET requests
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
