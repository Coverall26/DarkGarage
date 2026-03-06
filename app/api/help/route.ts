import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/errors";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const blocked = await appRouterRateLimit(request);
  if (blocked) return blocked;
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_MARKETING_URL}/api/help`,
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch help articles: ${response.status} ${response.statusText}`);
    }

    const { articles } = await response.json();

    // Filter articles based on search query if provided
    const filteredArticles = query
      ? articles.filter(
          (article: { data: { title: string; description?: string } }) =>
            article.data.title.toLowerCase().includes(query.toLowerCase()) ||
            article.data.description
              ?.toLowerCase()
              .includes(query.toLowerCase()),
        )
      : articles;

    return NextResponse.json({ articles: filteredArticles });
  } catch (error) {
    return errorResponse(error);
  }
}
