import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Users, FileSearch, ArrowRight } from "lucide-react";

export default function CompanyPortalPage() {
  return (
    <div className="container pb-16 pt-24">
      <div className="mx-auto max-w-4xl space-y-10 text-center">
        <div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Company Portal
          </h1>
          <p className="mt-4 text-lg text-vertex-muted">
            Find candidates from the talent pool by the skills you need.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 sm:items-stretch">
          <Card className="flex h-full flex-col text-left">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Search className="h-5 w-5 shrink-0" />
                Search Talent
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col space-y-4 text-sm text-vertex-muted">
              <p>
                Enter the skills your role requires. We rank candidates by
                keyword and semantic match so you see the best fits first.
              </p>
              <div className="mt-auto pt-2">
                <Button asChild className="w-full gap-2">
                  <Link href="/company/search">
                    Search candidates
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="flex h-full flex-col text-left">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <FileSearch className="h-5 w-5 shrink-0" />
                How it Works
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col space-y-3 text-sm text-vertex-muted">
              <div className="space-y-2">
                <p>1. Job seekers upload their CV and join the talent pool.</p>
                <p>2. You enter required skills and optional company name.</p>
                <p>3. Get a ranked list with match scores and contact details.</p>
              </div>
              <div className="mt-auto pt-2">
                <Button variant="outline" asChild className="w-full gap-2">
                  <Link href="/company/search">
                    <Users className="h-4 w-4" />
                    Start searching
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
