import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Users, FileSearch, ArrowRight } from "lucide-react";

export default function CompanyPortalPage() {
  return (
    <div className="container py-12">
      <div className="mx-auto max-w-3xl space-y-10 text-center">
        <div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Company Portal
          </h1>
          <p className="mt-4 text-lg text-vertex-muted">
            Find candidates from the talent pool by the skills you need.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Search className="h-5 w-5" />
                Search Talent
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-left text-sm text-vertex-muted">
              <p>
                Enter the skills your role requires. We rank candidates by
                keyword and semantic match so you see the best fits first.
              </p>
              <Button asChild className="w-full gap-2">
                <Link href="/company/search">
                  Search candidates
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <FileSearch className="h-5 w-5" />
                How it Works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-left text-sm text-vertex-muted">
              <p>1. Job seekers upload their CV and join the talent pool.</p>
              <p>2. You enter required skills and optional company name.</p>
              <p>3. Get a ranked list with match scores and contact details.</p>
              <Button variant="outline" asChild className="mt-2 w-full gap-2">
                <Link href="/company/search">
                  <Users className="h-4 w-4" />
                  Start searching
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div>
          <Button size="lg" asChild className="gap-2">
            <Link href="/company/search">
              Search Talent
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
